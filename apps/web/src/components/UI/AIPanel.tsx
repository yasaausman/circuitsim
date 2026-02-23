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
import type { ComponentType } from "@circuitsim/engine";

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
          const id = s.addComponent(type, value, { x: Number(x), y: 0, z: Number(z) }, rotation as 0 | 1, label);
          return JSON.stringify({ id, success: true });
        }
        case "connect": {
          const { fromComponentId, fromPinIndex, toComponentId, toPinIndex } = toolCall.args as {
            fromComponentId: string; fromPinIndex: 0 | 1; toComponentId: string; toPinIndex: 0 | 1;
          };
          const id = s.addWire(fromComponentId, fromPinIndex, toComponentId, toPinIndex);
          return JSON.stringify({ wireId: id, success: true });
        }
        case "remove_component": {
          s.removeComponent(toolCall.args.id as string);
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
          return JSON.stringify(store().circuit);
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
  const circuit = useCircuitStore((s) => s.circuit);
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
      // Gemini only accepts "user" | "model" roles — map correctly
      const history = newMessages
        .filter((m) => m.role !== "system") // system prompt is handled server-side
        .map((m) => ({
          role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
          content: m.content,
        }));

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          circuit,
          ...(apiKey ? { apiKey } : {}),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "API error");
      }

      const { reply, toolCalls }: { reply: string; toolCalls: ToolCall[] } = await res.json();

      // Execute tool calls
      let toolLog = "";
      if (toolCalls?.length > 0) {
        for (const tc of toolCalls) {
          const result = await executeTools(tc);
          toolLog += `\n⚡ \`${tc.name}\` → ${result}`;
        }
      }

      const assistantMsg: Message = {
        role: "assistant",
        content: reply + (toolLog ? "\n\n" + toolLog : ""),
        toolCalls,
      };
      setMessages((prev) => [...prev, assistantMsg]);
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
