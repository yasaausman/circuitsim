import { useEffect, useRef, useState } from "react";
import { diagnoseCircuit } from "@circuitsim/engine";
import type { Component, ComponentType } from "@circuitsim/engine";
import { Bot, Lightbulb, Send, Settings, User, Wrench } from "lucide-react";
import { useCircuitStore } from "../../store/circuit";
import { useSimStore } from "../../store/simulation";

interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolCall[];
}

function normalizeLabel(label: string) {
  return label.trim().toLowerCase();
}

function autoLabel(type: ComponentType, components: Component[]) {
  if (type === "ground") {
    const hasGround = components.some((component) => normalizeLabel(component.label ?? "") === "gnd");
    return hasGround
      ? `GND${components.filter((component) => normalizeLabel(component.label ?? "").startsWith("gnd")).length + 1}`
      : "GND";
  }

  const prefix: Record<ComponentType, string> = {
    resistor: "R",
    capacitor: "C",
    inductor: "L",
    voltage_source: "V",
    current_source: "I",
    switch: "SW",
    bulb: "B",
    ground: "GND",
  };

  const used = new Set(components.map((component) => normalizeLabel(component.label ?? "")));
  let index = 1;
  while (used.has(normalizeLabel(`${prefix[type]}${index}`))) {
    index += 1;
  }
  return `${prefix[type]}${index}`;
}

function resolveComponentRef(components: Component[], ref: unknown) {
  if (typeof ref !== "string") return null;
  const raw = ref.trim();
  if (!raw) return null;
  const byId = components.find((component) => component.id === raw);
  if (byId) return byId;
  const target = normalizeLabel(raw);
  return components.find((component) => normalizeLabel(component.label ?? "") === target) ?? null;
}

function terminalToPin(component: Component, terminal: unknown, fallback: 0 | 1 = 0): 0 | 1 {
  if (component.type === "ground") return 0;
  if (typeof terminal === "number") return terminal === 1 ? 1 : 0;
  if (typeof terminal !== "string") return fallback;

  const value = terminal.trim().toLowerCase();
  if (["0", "pin0", "left", "top", "positive", "plus", "+"].includes(value)) return 0;
  if (["1", "pin1", "right", "bottom", "negative", "minus", "-"].includes(value)) return 1;
  return fallback;
}

function terminalsFor(component: Component) {
  if (component.type === "ground") return ["gnd(pin0)"];
  return component.rotation === 0 ? ["left(pin0)", "right(pin1)"] : ["top(pin0)", "bottom(pin1)"];
}

function compactCircuitSnapshot(circuit: {
  components: Component[];
  wires: Array<{
    id: string;
    fromComponentId: string;
    fromPinIndex: 0 | 1;
    toComponentId: string;
    toPinIndex: 0 | 1;
  }>;
}) {
  const components = circuit.components.map((component) => ({
    id: component.id,
    label: component.label ?? null,
    type: component.type,
    value: component.value,
    rotation: component.rotation,
    position: { x: component.position.x, z: component.position.z },
    terminals: terminalsFor(component),
  }));

  const byId = new Map(circuit.components.map((component) => [component.id, component] as const));
  const wires = circuit.wires.map((wire) => ({
    id: wire.id,
    from: {
      id: wire.fromComponentId,
      label: byId.get(wire.fromComponentId)?.label ?? null,
      pin: wire.fromPinIndex,
    },
    to: {
      id: wire.toComponentId,
      label: byId.get(wire.toComponentId)?.label ?? null,
      pin: wire.toPinIndex,
    },
  }));

  return {
    note: "There is no cable component. Connect terminals with wires.",
    counts: { components: components.length, wires: wires.length },
    components,
    wires,
  };
}

function useToolExecutor() {
  const store = useCircuitStore.getState;
  const simStore = useSimStore.getState;

  return async (toolCall: ToolCall): Promise<string> => {
    const state = store();
    try {
      switch (toolCall.name) {
        case "add_component": {
          const { type, value, label, x = 0, z = 0, rotation = 0 } = toolCall.args as {
            type: ComponentType;
            value: number;
            label?: string;
            x?: number;
            z?: number;
            rotation?: 0 | 1;
          };
          const resolvedLabel = typeof label === "string" && label.trim()
            ? label.trim()
            : autoLabel(type, state.circuit.components);
          const id = state.addComponent(type, value, { x: Number(x), y: 0, z: Number(z) }, rotation, resolvedLabel);
          return JSON.stringify({ success: true, id, label: resolvedLabel });
        }

        case "connect": {
          const { fromComponentId, fromPinIndex, toComponentId, toPinIndex } = toolCall.args as {
            fromComponentId: string;
            fromPinIndex?: 0 | 1;
            toComponentId: string;
            toPinIndex?: 0 | 1;
          };
          const from = resolveComponentRef(state.circuit.components, fromComponentId);
          const to = resolveComponentRef(state.circuit.components, toComponentId);
          if (!from || !to) {
            return JSON.stringify({ success: false, error: "connect failed: component not found" });
          }
          const id = state.addWire(
            from.id,
            terminalToPin(from, fromPinIndex, 0),
            to.id,
            terminalToPin(to, toPinIndex, 0)
          );
          return JSON.stringify({ success: true, wireId: id });
        }

        case "connect_by_label": {
          const { fromLabel, fromTerminal, toLabel, toTerminal } = toolCall.args as {
            fromLabel: string;
            fromTerminal?: string;
            toLabel: string;
            toTerminal?: string;
          };
          const from = resolveComponentRef(state.circuit.components, fromLabel);
          const to = resolveComponentRef(state.circuit.components, toLabel);
          if (!from || !to) {
            return JSON.stringify({ success: false, error: "connect_by_label failed: label not found" });
          }
          const id = state.addWire(
            from.id,
            terminalToPin(from, fromTerminal, 0),
            to.id,
            terminalToPin(to, toTerminal, 0)
          );
          return JSON.stringify({ success: true, wireId: id });
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
          const target = resolveComponentRef(state.circuit.components, id ?? label ?? "");
          if (!target) {
            return JSON.stringify({ success: false, error: "update_component failed: component not found" });
          }
          state.updateComponent(target.id, {
            ...(typeof value === "number" ? { value } : {}),
            ...(typeof newLabel === "string" ? { label: newLabel } : {}),
            ...(typeof rotation === "number" ? { rotation: rotation === 1 ? 1 : 0 } : {}),
            ...((typeof x === "number" || typeof z === "number")
              ? {
                  position: {
                    x: typeof x === "number" ? x : target.position.x,
                    y: target.position.y,
                    z: typeof z === "number" ? z : target.position.z,
                  },
                }
              : {}),
          });
          return JSON.stringify({ success: true, id: target.id });
        }

        case "remove_component": {
          const target = resolveComponentRef(state.circuit.components, toolCall.args.id);
          if (!target) {
            return JSON.stringify({ success: false, error: "remove_component failed: component not found" });
          }
          state.removeComponent(target.id);
          return JSON.stringify({ success: true });
        }

        case "clear_circuit":
          state.clearCircuit();
          return JSON.stringify({ success: true });

        case "run_simulation": {
          const { type = "dc", frequency, stopTime, stepSize } = toolCall.args as {
            type?: "dc" | "ac" | "transient";
            frequency?: number;
            stopTime?: number;
            stepSize?: number;
          };
          const circuit = store().circuit;
          if (type === "ac") {
            simStore().run(circuit, { type: "ac", frequency: frequency ?? 1000 });
          } else if (type === "transient") {
            simStore().run(circuit, {
              type: "transient",
              stopTime: stopTime ?? 0.01,
              stepSize: stepSize ?? 0.0001,
            });
          } else {
            simStore().run(circuit, { type: "dc" });
          }
          return JSON.stringify({ success: true });
        }

        case "get_circuit":
          return JSON.stringify(compactCircuitSnapshot(store().circuit));

        default:
          return JSON.stringify({ success: false, error: `Unknown tool ${toolCall.name}` });
      }
    } catch (error) {
      return JSON.stringify({ success: false, error: String(error) });
    }
  };
}

export function AIPanel() {
  const circuit = useCircuitStore((state) => state.circuit);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "I can explain, build, and repair your circuit. Try the quick prompts below or ask in plain English.",
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

  function saveApiKey(value: string) {
    setApiKey(value);
    localStorage.setItem("gemini_api_key", value);
  }

  async function send(promptOverride?: string) {
    const prompt = (promptOverride ?? input).trim();
    if (!prompt || loading) return;

    const diagnostics = diagnoseCircuit(circuit);
    const diagnosticsText = diagnostics.length
      ? diagnostics.map((warning) => `- ${warning.title}: ${warning.message}`).join("\n")
      : "- No obvious structural warnings detected.";

    const userMessage: Message = { role: "user", content: prompt };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      let uiMessages = [...nextMessages];
      let agentHistory: Array<{ role: "user" | "assistant"; content: string }> = nextMessages.map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
      }));

      agentHistory = [
        ...agentHistory,
        {
          role: "user",
          content: `Circuit diagnostics:\n${diagnosticsText}\n\nRequest:\n${prompt}`,
        },
      ];

      const maxAgentSteps = 8;
      for (let step = 0; step < maxAgentSteps; step += 1) {
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: agentHistory,
            circuit: useCircuitStore.getState().circuit,
            ...(apiKey ? { apiKey } : {}),
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error ?? "API error");
        }

        const { reply, toolCalls }: { reply: string; toolCalls: ToolCall[] } = await response.json();
        const toolResults: Array<{ name: string; result: string }> = [];
        let toolLog = "";

        if (toolCalls?.length) {
          for (const toolCall of toolCalls) {
            const result = await executeTools(toolCall);
            toolResults.push({ name: toolCall.name, result });
            toolLog += `\nTool ${toolCall.name}: ${result}`;
          }
        }

        const assistantMessage: Message = {
          role: "assistant",
          content: reply + (toolLog ? `\n${toolLog}` : ""),
          toolCalls,
        };

        uiMessages = [...uiMessages, assistantMessage];
        setMessages(uiMessages);
        agentHistory = [...agentHistory, { role: "assistant", content: reply }];

        if (!toolCalls?.length) break;

        agentHistory = [
          ...agentHistory,
          {
            role: "user",
            content: `Tool results:\n${toolResults.map((item) => `${item.name}: ${item.result}`).join("\n")}\n\nContinue until the task is complete.`,
          },
        ];
      }
    } catch (error) {
      setMessages((previous) => [
        ...previous,
        { role: "assistant", content: `Error: ${String(error)}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot size={14} className="text-emerald-600" />
          <span className="text-xs font-medium text-slate-700">AI Companion</span>
          <span className="rounded bg-slate-100 px-1 text-[9px] text-slate-500">Gemini</span>
        </div>
        <button onClick={() => setShowSettings((value) => !value)} className="text-slate-500 hover:text-slate-700">
          <Settings size={13} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 px-4 py-3">
        <button
          onClick={() => send("Explain this circuit in plain English. Describe what it does and what a beginner should notice first.")}
          className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"
        >
          <Lightbulb size={12} />
          Explain this circuit
        </button>
        <button
          onClick={() => send("Fix my circuit. Correct wiring issues, missing ground, open circuits, or values that make the design fail, then explain the changes.")}
          className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
        >
          <Wrench size={12} />
          Fix my circuit
        </button>
        <button
          onClick={() => send("Build me a voltage divider with readable labels, wire it correctly, and run a DC simulation.")}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:border-amber-300 hover:text-amber-700"
        >
          Voltage divider
        </button>
        <button
          onClick={() => send("Add a low-pass filter to the current design, explain the frequency behavior, and run an AC analysis.")}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:border-amber-300 hover:text-amber-700"
        >
          Low-pass filter
        </button>
      </div>

      {showSettings && (
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <label className="mb-1 block text-[10px] text-slate-500">
            Gemini API Key <span className="text-slate-400">(optional override; server key used by default)</span>
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(event) => saveApiKey(event.target.value)}
            placeholder="AIza... (leave blank to use server key)"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-sky-400 focus:outline-none"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-slate-50/70 p-4">
        {messages.map((message, index) => (
          <div key={index} className={`flex gap-2 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${message.role === "assistant" ? "bg-emerald-100" : "border border-slate-200 bg-white"}`}>
              {message.role === "assistant" ? <Bot size={10} className="text-emerald-600" /> : <User size={10} className="text-slate-500" />}
            </div>
            <div
              className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm ${
                message.role === "assistant"
                  ? "border border-slate-200 bg-white text-slate-700"
                  : "border border-sky-200 bg-sky-50 text-sky-900"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
              <Bot size={10} className="text-emerald-600" />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-sm">
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-slate-200 bg-white px-4 py-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && !event.shiftKey && send()}
            placeholder="Ask the AI to build, explain, or fix a circuit"
            disabled={loading}
            className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 placeholder-slate-400 focus:border-emerald-400 focus:outline-none disabled:opacity-40"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="rounded-2xl border border-emerald-200 bg-emerald-50 p-2 text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-40"
          >
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
