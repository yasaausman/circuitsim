import { useState } from "react";
import { Bot, ChevronLeft, ChevronRight } from "lucide-react";
import { CircuitCanvas } from "./components/Canvas3D/CircuitCanvas";
import { Toolbar } from "./components/UI/Toolbar";
import { ComponentPalette } from "./components/UI/ComponentPalette";
import { SimControls } from "./components/UI/SimControls";
import { PropertyPanel } from "./components/UI/PropertyPanel";
import { AIPanel } from "./components/UI/AIPanel";

export default function App() {
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [activeRightTab, setActiveRightTab] = useState<"props" | "ai">("props");

  return (
    <div className="flex flex-col w-full h-full bg-surface text-gray-100">
      {/* Toolbar */}
      <Toolbar />

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left panel ── */}
        <div
          className={`flex-shrink-0 bg-surface-raised border-r border-surface-border flex flex-col transition-all duration-200 ${
            leftOpen ? "w-48" : "w-0 overflow-hidden"
          }`}
        >
          <ComponentPalette />
          <div className="border-t border-surface-border" />
          <SimControls />
        </div>

        {/* Left toggle */}
        <button
          onClick={() => setLeftOpen((v) => !v)}
          className="w-3 bg-surface-raised border-r border-surface-border flex items-center justify-center text-gray-600 hover:text-gray-300 hover:bg-surface-border transition-all z-10 flex-shrink-0"
        >
          {leftOpen ? <ChevronLeft size={10} /> : <ChevronRight size={10} />}
        </button>

        {/* ── 3D Canvas ── */}
        <div className="flex-1 relative overflow-hidden">
          <CircuitCanvas />

          {/* Status bar overlay */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none">
            <div className="bg-surface-raised/80 backdrop-blur border border-surface-border rounded px-2 py-1 text-[10px] text-gray-500 font-mono">
              Orbit: drag · Pan: right-drag · Zoom: scroll
            </div>
          </div>
        </div>

        {/* Right toggle */}
        <button
          onClick={() => setRightOpen((v) => !v)}
          className="w-3 bg-surface-raised border-l border-surface-border flex items-center justify-center text-gray-600 hover:text-gray-300 hover:bg-surface-border transition-all z-10 flex-shrink-0"
        >
          {rightOpen ? <ChevronRight size={10} /> : <ChevronLeft size={10} />}
        </button>

        {/* ── Right panel ── */}
        <div
          className={`flex-shrink-0 bg-surface-raised border-l border-surface-border flex flex-col transition-all duration-200 ${
            rightOpen ? "w-56" : "w-0 overflow-hidden"
          }`}
        >
          {/* Tab bar */}
          <div className="flex border-b border-surface-border">
            {(["props", "ai"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveRightTab(tab)}
                className={`flex-1 flex items-center justify-center gap-1 py-2 text-[11px] transition-all ${
                  activeRightTab === tab
                    ? "text-accent-green border-b-2 border-accent-green"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {tab === "ai" && <Bot size={11} />}
                {tab === "props" ? "Properties" : "AI"}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {activeRightTab === "props" ? <PropertyPanel /> : <AIPanel />}
          </div>
        </div>
      </div>
    </div>
  );
}
