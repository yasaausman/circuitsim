import { useCircuitStore } from "../../store/circuit";
import type { ComponentType } from "@circuitsim/engine";

const COMPONENTS: { type: ComponentType; label: string; symbol: string; unit: string }[] = [
  { type: "resistor",       label: "Resistor",        symbol: "R",  unit: "Ω" },
  { type: "capacitor",      label: "Capacitor",       symbol: "C",  unit: "F" },
  { type: "inductor",       label: "Inductor",        symbol: "L",  unit: "H" },
  { type: "voltage_source", label: "Voltage Source",  symbol: "V",  unit: "V" },
  { type: "current_source", label: "Current Source",  symbol: "I",  unit: "A" },
  { type: "ground",         label: "Ground",          symbol: "⏚", unit: "" },
];

export function ComponentPalette() {
  const { tool, setTool } = useCircuitStore();

  return (
    <div className="flex flex-col gap-1 p-2">
      <p className="text-[10px] text-gray-500 uppercase tracking-widest px-1 mb-1">Components</p>
      {COMPONENTS.map(({ type, label, symbol }) => {
        const active = tool.type === "place" && tool.componentType === type;
        return (
          <button
            key={type}
            onClick={() =>
              setTool(active ? { type: "select" } : { type: "place", componentType: type })
            }
            className={`
              flex items-center gap-2 px-3 py-2 rounded text-left text-sm transition-all
              ${active
                ? "bg-accent-green/20 text-accent-green border border-accent-green/40"
                : "text-gray-300 hover:bg-surface-raised border border-transparent hover:border-surface-border"
              }
            `}
          >
            <span className="w-5 text-center font-bold text-base">{symbol}</span>
            <span className="text-xs">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
