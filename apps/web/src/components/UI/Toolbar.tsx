import { MousePointer, Pencil, Crosshair, Trash2, RotateCcw, RotateCw, Save, FolderOpen } from "lucide-react";
import { useCircuitStore } from "../../store/circuit";

export function Toolbar() {
  const { tool, setTool, clearCircuit, circuit } = useCircuitStore();

  const tools = [
    { id: "select",  icon: MousePointer, label: "Select (S)" },
    { id: "wire",    icon: Pencil,       label: "Wire (W)" },
    { id: "probe",   icon: Crosshair,    label: "Probe (P)" },
    { id: "delete",  icon: Trash2,       label: "Delete (Del)" },
  ] as const;

  function saveCircuit() {
    const blob = new Blob([JSON.stringify(circuit, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${circuit.name ?? "circuit"}.json`;
    a.click();
  }

  function loadCircuit() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const parsed = JSON.parse(text);
        useCircuitStore.getState().loadCircuit(parsed);
      } catch {
        alert("Invalid circuit file");
      }
    };
    input.click();
  }

  return (
    <div className="h-10 flex items-center gap-1 px-3 border-b border-surface-border bg-surface-raised">
      {/* Logo */}
      <div className="flex items-center gap-1.5 mr-4">
        <div className="w-4 h-4 rounded-sm bg-accent-green/20 border border-accent-green/40 flex items-center justify-center">
          <span className="text-[8px] text-accent-green font-bold">CS</span>
        </div>
        <span className="text-xs font-medium text-gray-400">CircuitSim</span>
      </div>

      {/* Tool buttons */}
      <div className="flex gap-0.5">
        {tools.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            title={label}
            onClick={() => setTool({ type: id as any })}
            className={`p-1.5 rounded transition-all ${
              tool.type === id
                ? "bg-accent-green/20 text-accent-green"
                : "text-gray-500 hover:text-gray-300 hover:bg-surface"
            }`}
          >
            <Icon size={14} />
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-surface-border mx-1" />

      {/* File ops */}
      <button title="Save circuit" onClick={saveCircuit} className="p-1.5 rounded text-gray-500 hover:text-gray-300 hover:bg-surface transition-all">
        <Save size={14} />
      </button>
      <button title="Load circuit" onClick={loadCircuit} className="p-1.5 rounded text-gray-500 hover:text-gray-300 hover:bg-surface transition-all">
        <FolderOpen size={14} />
      </button>

      <div className="w-px h-5 bg-surface-border mx-1" />

      <button
        title="Clear circuit"
        onClick={() => { if (confirm("Clear all components?")) clearCircuit(); }}
        className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-surface transition-all"
      >
        <RotateCcw size={14} />
      </button>

      {/* Circuit name */}
      <div className="ml-auto text-[10px] text-gray-600 font-mono">
        {circuit.name}
      </div>
    </div>
  );
}
