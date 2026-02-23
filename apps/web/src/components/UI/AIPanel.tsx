/**
 * Gemini AI companion panel.
 *
 * The agent loop:
 *   1. User types a message
 *   2. POST /api/ai/chat with current circuit state
 *   3. API returns { reply, toolCalls }
 *   4. Frontend executes toolCalls against circuit store
 *   5. If there were tool calls, send results back (next turn)
 *   6. Display reply to user
 */

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Zap, Settings } from "lucide-react";
import { useCircuitStore } from "../../store/circuit";
import { useSimStore } from "../../store/simulation";
import type { Component, ComponentType } from "@circuitsim/engine";

interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

function autoLabel(type: ComponentType, components: Component[]): string {
  if (type === "ground") {
    const hasGnd = components.some((c) => normalizeLabel(c.label ?? "") === "gnd");
    return hasGnd ? `GND${components.filter((c) => normalizeLabel(c.label ?? "").startsWith("gnd")).length + 1}` : "GND";
  }

  const prefix: Record<ComponentType, string> = {
    resistor: "R",
    capacitor: "C",
    inductor: "L",
    voltage_source: "V",
    current_source: "I",
    bulb: "B",
    ground: "GND",
  };

  const p = prefix[type];
  const used = new Set(
    components.map((c) => normalizeLabel(c.label ?? ""))
  );
  let idx = 1;
  while (used.has(normalizeLabel(`${p}${idx}`))) idx += 1;
  return `${p}${idx}`;
}

function resolveComponentRef(components: Component[], ref: unknown): Component | null {
  if (typeof ref !== "string") return null;
  const raw = ref.trim();
  if (!raw) return null;
  const byId = components.find((c) => c.id === raw);
  if (byId) return byId;
  const target = normalizeLabel(raw);
  return components.find((c) => normalizeLabel(c.label ?? "") === target) ?? null;
}

function terminalToPin(component: Component, terminal: unknown, fallback: 0 | 1 = 0): 0 | 1 {
  if (component.type === "ground") return 0;

  if (typeof terminal === "number") return terminal === 1 ? 1 : 0;

  if (typeof terminal !== "string") return fallback;
  const t = terminal.trim().toLowerCase();

  if (["0", "pin0", "a", "start", "positive", "plus", "+"].includes(t)) return 0;
  if (["1", "pin1", "b", "end", "negative", "minus", "-"].includes(t)) return 1;

  if (t === "left") return component.rotation === 0 ? 0 : fallback;
  if (t === "right") return component.rotation === 0 ? 1 : fallback;
  if (t === "top") return component.rotation === 1 ? 0 : fallback;
  if (t === "bottom") return component.rotation === 1 ? 1 : fallback;

  return fallback;
}

function terminalsFor(component: Component): string[] {
  if (component.type === "ground") return ["gnd(pin0)"];
  if (component.rotation === 0) return ["left(pin0)", "right(pin1)"];
  return ["top(pin0)", "bottom(pin1)"];
}

function compactCircuitSnapshot(circuit: { components: Component[]; wires: Array<{
  id: string;
  fromComponentId: string;
  fromPinIndex: 0 | 1;
  toComponentId: string;
  toPinIndex: 0 | 1;
}> }) {
  const components = circuit.components.map((c) => ({
    id: c.id,
    label: c.label ?? null,
    type: c.type,
    value: c.value,
    rotation: c.rotation,
    position: { x: c.position.x, z: c.position.z },
    terminals: terminalsFor(c),
  }));

  const byId = new Map(circuit.components.map((c) => [c.id, c] as const));
  const wires = circuit.wires.map((w) => {
    const from = byId.get(w.fromComponentId);
    const to = byId.get(w.toComponentId);
    return {
      id: w.id,
      from: {
        id: w.fromComponentId,
        label: from?.label ?? null,
        pin: w.fromPinIndex,
      },
      to: {
        id: w.toComponentId,
        label: to?.label ?? null,
        pin: w.toPinIndex,
      },
    };
  });

  return {
    note: "No cable component exists. Create wires via connect/connect_by_label.",
    counts: { components: components.length, wires: wires.length },
    components,
    wires,
  };
}

// ─── Tool executor ────────────────────────────────────────────────────────────

function useToolExecutor() {
  const store = useCircuitStore.getState;
  const simStore = useSimStore.getState;

  return async (toolCall: ToolCall): Promise<string> => {
    const s = store();
    try {
      switch (toolCall.name) {
        case "add_component": {
          const { type, value, label, x = 0, z = 0, rotation = 0 } = toolCall.args as {
            type: ComponentType; value: number; label?: string; x?: number; z?: number; rotation?: 0 | 1;
          };
          const resolvedLabel = (typeof label === "string" && label.trim())
            ? label.trim()
            : autoLabel(type, s.circuit.components);
          const id = s.addComponent(type, value, { x: Number(x), y: 0, z: Number(z) }, rotation as 0 | 1, resolvedLabel);
          return JSON.stringify({ id, label: resolvedLabel, success: true });
        }
        case "connect": {
          const { fromComponentId, fromPinIndex, toComponentId, toPinIndex } = toolCall.args as {
            fromComponentId: string; fromPinIndex?: 0 | 1; toComponentId: string; toPinIndex?: 0 | 1;
          };
          const from = resolveComponentRef(s.circuit.components, fromComponentId);
          const to = resolveComponentRef(s.circuit.components, toComponentId);
          if (!from || !to) {
            return JSON.stringify({
              success: false,
              error: "connect failed: component not found",
              availableLabels: s.circuit.components.map((c) => c.label).filter(Boolean),
            });
          }
          const id = s.addWire(
            from.id,
            terminalToPin(from, fromPinIndex, 0),
            to.id,
            terminalToPin(to, toPinIndex, 0)
          );
          return JSON.stringify({ wireId: id, from: from.label ?? from.id, to: to.label ?? to.id, success: true });
        }
        case "connect_by_label": {
          const { fromLabel, fromTerminal, toLabel, toTerminal } = toolCall.args as {
            fromLabel: string; fromTerminal?: string; toLabel: string; toTerminal?: string;
          };
          const from = resolveComponentRef(s.circuit.components, fromLabel);
          const to = resolveComponentRef(s.circuit.components, toLabel);
          if (!from || !to) {
            return JSON.stringify({
              success: false,
              error: "connect_by_label failed: label not found",
              availableLabels: s.circuit.components.map((c) => c.label).filter(Boolean),
            });
          }
          const id = s.addWire(
            from.id,
            terminalToPin(from, fromTerminal, 0),
            to.id,
            terminalToPin(to, toTerminal, 0)
          );
          return JSON.stringify({
            wireId: id,
            from: { label: from.label ?? from.id, terminal: fromTerminal ?? "pin0" },
            to: { label: to.label ?? to.id, terminal: toTerminal ?? "pin0" },
            success: true,
          });
        }
        case "update_component": {
          const { id, label, value, newLabel, x, z, rotation } = toolCall.args as {
            id?: string;
            label?: string;
            value?: number;
            newLabel?: string;
            x?: number;
            z?: number;
            rotation?: 0 | 1;
          };
          const target = resolveComponentRef(s.circuit.components, id ?? label ?? "");
          if (!target) {
            return JSON.stringify({
              success: false,
              error: "update_component failed: component not found",
              availableLabels: s.circuit.components.map((c) => c.label).filter(Boolean),
            });
          }
          s.updateComponent(target.id, {
            ...(typeof value === "number" ? { value } : {}),
            ...(typeof newLabel === "string" && newLabel.trim() ? { label: newLabel.trim() } : {}),
            ...(typeof rotation === "number" ? { rotation: rotation === 1 ? 1 : 0 } : {}),
            ...((typeof x === "number" || typeof z === "number")
              ? {
                position: {
                  x: typeof x === "number" ? Number(x) : target.position.x,
                  y: target.position.y,
                  z: typeof z === "number" ? Number(z) : target.position.z,
                },
              }
              : {}),
          });
          return JSON.stringify({ success: true, id: target.id });
        }
        case "remove_component": {
          const target = resolveComponentRef(s.circuit.components, toolCall.args.id);
          if (!target) {
            return JSON.stringify({
              success: false,
              error: "remove_component failed: component not found",
              availableLabels: s.circuit.components.map((c) => c.label).filter(Boolean),
            });
          }
          s.removeComponent(target.id);
          return JSON.stringify({ success: true });
        }
        case "clear_circuit": {
          s.clearCircuit();
          return JSON.stringify({ success: true });
        }
        case "run_simulation": {
          const { type = "dc", stopTime, stepSize } = toolCall.args as {
            type?: "dc" | "transient"; stopTime?: number; stepSize?: number;
          };
          const circuit = store().circuit;
          if (type === "dc") {
            simStore().run(circuit, { type: "dc" });
          } else {
            simStore().run(circuit, { type: "transient", stopTime: stopTime ?? 0.01, stepSize: stepSize ?? 0.0001 });
          }
          return JSON.stringify({ success: true, message: "Simulation started" });
        }
        case "get_circuit": {
          return JSON.stringify(compactCircuitSnapshot(store().circuit));
        }
        default:
          return JSON.stringify({ error: `Unknown tool: ${toolCall.name}` });
      }
    } catch (e) {
      return JSON.stringify({ error: String(e) });
    }
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AIPanel() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm CircuitSim AI, powered by Gemini. I can build, modify, and analyse circuits for you.\n\nTry: *\"Build a simple voltage divider with 10kΩ and 2.2kΩ resistors powered by 5V\"*",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("gemini_api_key") ?? "");
  const [showSettings, setShowSettings] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const executeTools = useToolExecutor();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem("gemini_api_key", key);
  };

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      let uiMessages = [...newMessages];
      let agentHistory: Array<{ role: "user" | "assistant"; content: string }> = newMessages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
          content: m.content,
        }));

      const MAX_AGENT_STEPS = 8;
      for (let step = 0; step < MAX_AGENT_STEPS; step++) {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: agentHistory,
            circuit: useCircuitStore.getState().circuit,
            ...(apiKey ? { apiKey } : {}),
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "API error");
        }

        const { reply, toolCalls }: { reply: string; toolCalls: ToolCall[] } = await res.json();

        let toolLog = "";
        const toolResults: Array<{ name: string; result: string }> = [];
        if (toolCalls?.length > 0) {
          for (const tc of toolCalls) {
            const result = await executeTools(tc);
            toolResults.push({ name: tc.name, result });
            toolLog += `\n⚡ \`${tc.name}\` → ${result}`;
          }
        }

        const assistantMsg: Message = {
          role: "assistant",
          content: reply + (toolLog ? "\n\n" + toolLog : ""),
          toolCalls,
        };
        uiMessages = [...uiMessages, assistantMsg];
        setMessages(uiMessages);

        agentHistory = [
          ...agentHistory,
          { role: "assistant", content: reply },
        ];

        if (!toolCalls?.length) break;

        const toolResultPayload = toolResults
          .map((t) => `${t.name}: ${t.result}`)
          .join("\n");

        agentHistory = [
          ...agentHistory,
          {
            role: "user",
            content: `Tool results:\n${toolResultPayload}\n\nContinue until the task is complete. If complete, respond normally without calling tools.`,
          },
        ];

        if (step === MAX_AGENT_STEPS - 1) {
          uiMessages = [
            ...uiMessages,
            {
              role: "assistant",
              content: "Reached agent step limit before completion. Ask me to continue and I will keep going from the current state.",
            },
          ];
          setMessages(uiMessages);
        }
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant" as const, content: `❌ Error: ${String(e)}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-border">
        <div className="flex items-center gap-1.5">
          <Bot size={14} className="text-accent-green" />
          <span className="text-xs font-medium text-gray-300">AI Companion</span>
          <span className="text-[9px] text-gray-600 bg-surface-raised px-1 rounded">Gemini</span>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="text-gray-500 hover:text-gray-300">
          <Settings size={13} />
        </button>
      </div>

      {/* API key settings */}
      {showSettings && (
        <div className="p-2 border-b border-surface-border bg-surface-raised">
          <label className="text-[10px] text-gray-500 block mb-1">Gemini API Key <span className="text-gray-600">(optional override — server key used by default)</span></label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => saveApiKey(e.target.value)}
            placeholder="AIza… (leave blank to use server key)"
            className="w-full bg-surface border border-surface-border rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-accent-blue"
          />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center ${msg.role === "assistant" ? "bg-accent-green/20" : "bg-surface-raised border border-surface-border"}`}>
              {msg.role === "assistant" ? <Bot size={10} className="text-accent-green" /> : <User size={10} className="text-gray-400" />}
            </div>
            <div
              className={`text-xs rounded-lg px-3 py-2 max-w-[85%] whitespace-pre-wrap leading-relaxed ${
                msg.role === "assistant"
                  ? "bg-surface-raised border border-surface-border text-gray-300"
                  : "bg-accent-blue/20 border border-accent-blue/30 text-blue-100"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center bg-accent-green/20">
              <Bot size={10} className="text-accent-green" />
            </div>
            <div className="text-xs rounded-lg px-3 py-2 bg-surface-raised border border-surface-border text-gray-500">
              <span className="inline-flex gap-1">
                <span className="animate-bounce" style={{ animationDelay: "0ms" }}>●</span>
                <span className="animate-bounce" style={{ animationDelay: "150ms" }}>●</span>
                <span className="animate-bounce" style={{ animationDelay: "300ms" }}>●</span>
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-2 border-t border-surface-border">
        <div className="flex gap-1.5">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Ask or describe a circuit…"
            disabled={loading}
            className="flex-1 bg-surface-raised border border-surface-border rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent-green disabled:opacity-40 transition-all"
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="p-2 rounded-lg bg-accent-green/20 text-accent-green border border-accent-green/30 hover:bg-accent-green/30 disabled:opacity-40 transition-all"
          >
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
