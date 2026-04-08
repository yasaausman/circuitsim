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
    description: "Add a circuit component at a grid position. Prefer setting a readable label like R1, V1, GND.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        type: {
          type: SchemaType.STRING,
          enum: ["resistor", "capacitor", "inductor", "voltage_source", "current_source", "switch", "bulb", "ground"],
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
    description: "Connect two component pins with a wire, usually by component IDs returned from tools.",
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
    name: "connect_by_label",
    description: "Connect two components by label (preferred). Use terminal names like left/right/top/bottom/positive/negative/pin0/pin1.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        fromLabel: { type: SchemaType.STRING, description: "Source component label, e.g. V1" },
        fromTerminal: {
          type: SchemaType.STRING,
          description: "Optional terminal selector: pin0, pin1, left, right, top, bottom, positive, negative, plus, minus",
        },
        toLabel: { type: SchemaType.STRING, description: "Destination component label, e.g. R1" },
        toTerminal: {
          type: SchemaType.STRING,
          description: "Optional terminal selector: pin0, pin1, left, right, top, bottom, positive, negative, plus, minus",
        },
      },
      required: ["fromLabel", "toLabel"],
    },
  },
  {
    name: "update_component",
    description: "Update a component by ID or label. Useful to fix values, labels, rotation, or placement.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        id: { type: SchemaType.STRING, description: "Component ID (optional if label is provided)" },
        label: { type: SchemaType.STRING, description: "Component label used as identifier when id is not provided" },
        value: { type: SchemaType.NUMBER, description: "New SI value: Ω, F, H, V, or A" },
        newLabel: { type: SchemaType.STRING, description: "New display label" },
        x: { type: SchemaType.NUMBER, description: "New X position" },
        z: { type: SchemaType.NUMBER, description: "New Z position" },
        rotation: { type: SchemaType.NUMBER, description: "0 = horizontal, 1 = vertical" },
      },
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
        type: { type: SchemaType.STRING, enum: ["dc", "ac", "transient"] },
        frequency: { type: SchemaType.NUMBER, description: "AC frequency in Hz" },
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
Important: there is no "cable component". Wires are created only with connect/connect_by_label tools.
Component grid coordinates: place components on a 2D XZ grid (integer coords, snapped in app).
Typical spacing: 2 to 4 units between components. Keep circuits tidy.

When building circuits:
1. Place components first (add_component), and assign clear labels (V1, R1, R2, GND, etc.)
2. Connect them with wires (prefer connect_by_label)
3. Always include at least one ground component
4. Run simulation to verify
5. If a tool fails, call get_circuit and then repair using update_component / reconnect

For explain/fix requests:
- Explain in plain English first, not just raw numbers
- If the user asks to fix the circuit, inspect it, correct it with tools, then summarize the changes

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

function circuitSummaryText(circuit: unknown): string {
  const c = circuit as {
    components?: Array<{
      id?: string;
      label?: string;
      type?: string;
      value?: number;
      rotation?: 0 | 1;
      position?: { x?: number; z?: number };
    }>;
    wires?: Array<{
      id?: string;
      fromComponentId?: string;
      fromPinIndex?: 0 | 1;
      toComponentId?: string;
      toPinIndex?: 0 | 1;
    }>;
  };

  const comps = Array.isArray(c?.components) ? c.components : [];
  const wires = Array.isArray(c?.wires) ? c.wires : [];
  const byId = new Map(comps.map((x) => [x.id ?? "", x]));

  const compLines = comps.map((x, i) => {
    const id = x.id ?? `unknown_${i}`;
    const label = x.label ?? "(no-label)";
    const type = x.type ?? "unknown";
    const value = typeof x.value === "number" ? x.value : "n/a";
    const rot = x.rotation === 1 ? "vertical" : "horizontal";
    const pos = `x=${x.position?.x ?? "?"}, z=${x.position?.z ?? "?"}`;
    const terms = x.type === "ground" ? "gnd(pin0)" : (x.rotation === 1 ? "top(pin0), bottom(pin1)" : "left(pin0), right(pin1)");
    return `- ${label} [${id}] type=${type} value=${value} ${rot} ${pos} terminals=${terms}`;
  });

  const wireLines = wires.map((w, i) => {
    const from = byId.get(w.fromComponentId ?? "");
    const to = byId.get(w.toComponentId ?? "");
    const fromLabel = from?.label ?? w.fromComponentId ?? `from_${i}`;
    const toLabel = to?.label ?? w.toComponentId ?? `to_${i}`;
    return `- ${fromLabel}.pin${w.fromPinIndex ?? "?"} -> ${toLabel}.pin${w.toPinIndex ?? "?"}`;
  });

  return [
    `Components (${compLines.length})`,
    ...(compLines.length ? compLines : ["- none"]),
    `Wires (${wireLines.length})`,
    ...(wireLines.length ? wireLines : ["- none"]),
  ].join("\n");
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

  // Inject current circuit state as context in both machine and readable forms
  const userText = `Current circuit summary:
${circuitSummaryText(circuit)}

Current circuit JSON:
${JSON.stringify(circuit, null, 2)}

---

${lastMessage.content}`;

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
