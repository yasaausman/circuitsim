/**
 * AI companion endpoint — Gemini function-calling agent loop.
 *
 * POST /api/ai/chat
 *   Body: { messages: ChatMessage[], circuit: Circuit, apiKey?: string }
 *   Returns: { reply: string, toolCalls: ToolCall[] }
 *
 * The agent loop runs entirely server-side:
 *   1. Send conversation to Gemini with circuit tools declared
 *   2. Gemini returns tool_use → we record which tools to call
 *   3. The FRONTEND executes tool calls (it owns circuit state)
 *   4. Client resumes by POSTing tool results back
 *
 * This keeps circuit state in the browser while hiding the API key.
 */

import { Hono } from "hono";
import {
  GoogleGenerativeAI,
  SchemaType,
  type FunctionDeclaration,
  type Tool,
  type Content,
} from "@google/generative-ai";

export const aiRoutes = new Hono();

// ─── Tool declarations ────────────────────────────────────────────────────────

const CIRCUIT_TOOLS: FunctionDeclaration[] = [
  {
    name: "add_component",
    description: "Add a circuit component at a grid position.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        type: {
          type: SchemaType.STRING,
          enum: ["resistor", "capacitor", "inductor", "voltage_source", "current_source", "ground"],
          description: "Component type",
        },
        value: { type: SchemaType.NUMBER, description: "SI value: Ω, F, H, V, or A" },
        label: { type: SchemaType.STRING, description: "Optional label" },
        x: { type: SchemaType.NUMBER, description: "Grid X position" },
        z: { type: SchemaType.NUMBER, description: "Grid Z position" },
        rotation: { type: SchemaType.NUMBER, description: "0 = horizontal, 1 = vertical" },
      },
      required: ["type", "value", "x", "z"],
    },
  },
  {
    name: "connect",
    description: "Connect two component pins with a wire.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        fromComponentId: { type: SchemaType.STRING },
        fromPinIndex: { type: SchemaType.NUMBER, description: "0 or 1" },
        toComponentId: { type: SchemaType.STRING },
        toPinIndex: { type: SchemaType.NUMBER, description: "0 or 1" },
      },
      required: ["fromComponentId", "fromPinIndex", "toComponentId", "toPinIndex"],
    },
  },
  {
    name: "remove_component",
    description: "Remove a component (and its wires) by ID.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { id: { type: SchemaType.STRING } },
      required: ["id"],
    },
  },
  {
    name: "clear_circuit",
    description: "Remove all components and wires.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
  {
    name: "run_simulation",
    description: "Simulate the current circuit.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        type: { type: SchemaType.STRING, enum: ["dc", "transient"] },
        stopTime: { type: SchemaType.NUMBER, description: "Transient stop time (s)" },
        stepSize: { type: SchemaType.NUMBER, description: "Transient step size (s)" },
      },
      required: ["type"],
    },
  },
  {
    name: "get_circuit",
    description: "Return the current circuit state as JSON.",
    parameters: { type: SchemaType.OBJECT, properties: {} },
  },
];

const TOOLS: Tool[] = [{ functionDeclarations: CIRCUIT_TOOLS }];

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are CircuitSim AI — an expert electronics engineer assistant embedded in a 3D circuit simulator.

You can build, modify, and analyse circuits using the provided tools.
Component grid coordinates: place components on a 2D XZ grid (integer coords).
Typical spacing: 3 units between components. Keep circuits tidy.

When building circuits:
1. Place components first (add_component), noting their IDs from the response
2. Connect them with wires (connect)
3. Always include at least one ground component
4. Run simulation to verify

Respond concisely. When calling tools, explain briefly what you're doing.`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolName?: string;
}

interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

// ─── Route ────────────────────────────────────────────────────────────────────

aiRoutes.post("/chat", async (c) => {
  const { messages, circuit, apiKey } = await c.req.json<{
    messages: ChatMessage[];
    circuit: unknown;
    apiKey?: string;
  }>();

  const key = apiKey ?? process.env.GEMINI_API_KEY;
  if (!key) {
    return c.json({ error: "No Gemini API key configured. Set GEMINI_API_KEY or pass apiKey in the request." }, 400);
  }

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: SYSTEM_PROMPT,
    tools: TOOLS,
  });

  // Convert our message format to Gemini Content[]
  // Gemini requires history to start with a "user" message — drop any leading
  // "model" messages (e.g. the welcome greeting injected by the frontend).
  const allHistory: Content[] = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const firstUserIdx = allHistory.findIndex((m) => m.role === "user");
  const history = firstUserIdx >= 0 ? allHistory.slice(firstUserIdx) : [];

  const lastMessage = messages[messages.length - 1];

  // Inject current circuit state as context
  const userText = `Current circuit state:\n${JSON.stringify(circuit, null, 2)}\n\n---\n\n${lastMessage.content}`;

  try {
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(userText);
    const response = result.response;

    // Collect tool calls
    const toolCalls: ToolCall[] = [];
    let replyText = "";

    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.text) replyText += part.text;
      if (part.functionCall) {
        toolCalls.push({
          id: `tc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: part.functionCall.name,
          args: part.functionCall.args as Record<string, unknown>,
        });
      }
    }

    return c.json({ reply: replyText, toolCalls });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ error: msg }, 500);
  }
});
