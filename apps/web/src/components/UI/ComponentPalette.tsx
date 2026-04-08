import type { ComponentType } from "@circuitsim/engine";
import { useCircuitStore } from "../../store/circuit";

const COMPONENTS: Array<{ type: ComponentType; label: string; symbol: string; hint: string }> = [
  { type: "resistor", label: "Resistor", symbol: "R", hint: "Limits current" },
  { type: "capacitor", label: "Capacitor", symbol: "C", hint: "Stores charge" },
  { type: "inductor", label: "Inductor", symbol: "L", hint: "Stores magnetic energy" },
  { type: "voltage_source", label: "Voltage Source", symbol: "V", hint: "Supplies voltage" },
  { type: "current_source", label: "Current Source", symbol: "I", hint: "Supplies current" },
  { type: "switch", label: "Switch", symbol: "S", hint: "Closes at a chosen time" },
  { type: "bulb", label: "Bulb", symbol: "B", hint: "Visual load" },
  { type: "ground", label: "Ground", symbol: "G", hint: "Reference node" },
];

export function ComponentPalette() {
  const tool = useCircuitStore((state) => state.tool);
  const setTool = useCircuitStore((state) => state.setTool);

  return (
    <div className="flex flex-col gap-2 p-3">
      <p className="px-1 text-[10px] uppercase tracking-[0.25em] text-slate-500">Components</p>
      {COMPONENTS.map(({ type, label, symbol, hint }) => {
        const active = tool.type === "place" && tool.componentType === type;
        return (
          <button
            key={type}
            onClick={() => setTool(active ? { type: "select" } : { type: "place", componentType: type })}
            className={`rounded-2xl border px-3 py-3 text-left transition ${
              active
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 shadow-sm"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-700">
                {symbol}
              </div>
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-slate-500">{hint}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
