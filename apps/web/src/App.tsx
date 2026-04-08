import { Suspense, lazy, useEffect, useState } from "react";
import { Bot, ChevronLeft, ChevronRight } from "lucide-react";
import { decodeCircuitFromUrl, encodeCircuitToUrl } from "./lib/circuit-tools";
import { CircuitCanvas } from "./components/Canvas3D/CircuitCanvas";
import { Toolbar } from "./components/UI/Toolbar";
import { ComponentPalette } from "./components/UI/ComponentPalette";
import { SimControls } from "./components/UI/SimControls";
import { PropertyPanel } from "./components/UI/PropertyPanel";
import { useCircuitStore } from "./store/circuit";

const AIPanel = lazy(() => import("./components/UI/AIPanel").then((module) => ({ default: module.AIPanel })));

export default function App() {
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [activeRightTab, setActiveRightTab] = useState<"props" | "ai">("props");
  const circuit = useCircuitStore((state) => state.circuit);
  const loadCircuit = useCircuitStore((state) => state.loadCircuit);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("c");
    if (!encoded) return;
    const decoded = decodeCircuitFromUrl(encoded);
    if (decoded) {
      loadCircuit(decoded);
    }
  }, [loadCircuit]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("c", encodeCircuitToUrl(circuit));
    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
  }, [circuit]);

  return (
    <div className="flex h-full w-full min-h-0 flex-col bg-slate-100 text-slate-900">
      <Toolbar />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className={`flex min-h-0 flex-shrink-0 flex-col border-r border-slate-200 bg-slate-50 transition-all duration-200 ${leftOpen ? "w-72" : "w-0 overflow-hidden"}`}>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ComponentPalette />
            <div className="border-t border-slate-200" />
            <SimControls />
          </div>
        </div>

        <button
          onClick={() => setLeftOpen((value) => !value)}
          className="z-10 flex w-4 flex-shrink-0 items-center justify-center border-r border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
        >
          {leftOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
        </button>

        <div className="relative min-h-0 flex-1 overflow-hidden bg-white">
          <CircuitCanvas />
          <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
            <div className="rounded-full border border-slate-200 bg-white/85 px-3 py-1 text-[10px] text-slate-600 shadow-sm backdrop-blur">
              Orbit: drag · Pan: right-drag · Zoom: scroll · Wires snap to grid
            </div>
          </div>
        </div>

        <button
          onClick={() => setRightOpen((value) => !value)}
          className="z-10 flex w-4 flex-shrink-0 items-center justify-center border-l border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
        >
          {rightOpen ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>

        <div className={`flex min-h-0 flex-shrink-0 flex-col border-l border-slate-200 bg-slate-50 transition-all duration-200 ${rightOpen ? "w-80" : "w-0 overflow-hidden"}`}>
          <div className="flex border-b border-slate-200">
            {(["props", "ai"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveRightTab(tab)}
                className={`flex flex-1 items-center justify-center gap-1 py-3 text-xs font-medium transition ${
                  activeRightTab === tab
                    ? "border-b-2 border-emerald-500 text-emerald-700"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {tab === "ai" && <Bot size={12} />}
                {tab === "props" ? "Properties" : "AI"}
              </button>
            ))}
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {activeRightTab === "props" ? (
              <PropertyPanel />
            ) : (
              <Suspense fallback={<div className="p-4 text-sm text-slate-500">Loading AI panel...</div>}>
                <AIPanel />
              </Suspense>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
