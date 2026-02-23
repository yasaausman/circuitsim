import { useState, useEffect } from "react";
import { useCircuitStore } from "../../store/circuit";
import { useSimStore } from "../../store/simulation";
import { buildNetlist } from "@circuitsim/engine";

const UNITS: Record<string, string> = {
  resistor: "Ω",
  capacitor: "F",
  inductor: "H",
  voltage_source: "V",
  current_source: "A",
  ground: "",
};

export function PropertyPanel() {
  const { circuit, selectedId, updateComponent } = useCircuitStore();
  const { result, currentFrame, getNodeVoltage, getBranchCurrent } = useSimStore();

  const comp = circuit.components.find((c) => c.id === selectedId);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    if (comp) setEditValue(String(comp.value));
  }, [comp?.id, comp?.value]);

  if (!comp) {
    return (
      <div className="p-3">
        <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Properties</p>
        <p className="text-xs text-gray-600">Select a component</p>
      </div>
    );
  }

  // Get simulation results for this component
  const current = getBranchCurrent(comp.id);
  const netlist = buildNetlist(circuit.components, circuit.wires);
  const node0 = netlist.terminalToNode.get(`${comp.id}:0`) ?? null;
  const node1 = netlist.terminalToNode.get(`${comp.id}:1`) ?? null;
  const v0 = node0 ? getNodeVoltage(node0) : null;
  const v1 = node1 ? getNodeVoltage(node1) : null;
  const vDiff = v0 !== null && v1 !== null ? v0 - v1 : null;

  function commitValue() {
    const n = parseFloat(editValue);
    if (!isNaN(n) && n >= 0) updateComponent(comp!.id, { value: n });
  }

  const toggleRotation = () =>
    updateComponent(comp.id, { rotation: comp.rotation === 0 ? 1 : 0 });

  return (
    <div className="p-3 flex flex-col gap-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-widest">Properties</p>

      <div className="flex flex-col gap-1 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-400">Type</span>
          <span className="text-gray-200 capitalize">{comp.type.replace("_", " ")}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">ID</span>
          <span className="text-gray-500 truncate max-w-[100px]">{comp.id}</span>
        </div>
      </div>

      {/* Value editor */}
      {comp.type !== "ground" && (
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-gray-400">Value ({UNITS[comp.type]})</span>
          <div className="flex gap-1">
            <input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitValue}
              onKeyDown={(e) => e.key === "Enter" && commitValue()}
              className="flex-1 bg-surface-raised border border-surface-border rounded px-2 py-1 text-gray-200 focus:outline-none focus:border-accent-blue"
            />
          </div>
        </label>
      )}

      {/* Rotation */}
      {comp.type !== "ground" && (
        <button
          onClick={toggleRotation}
          className="text-xs py-1 rounded border border-surface-border text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-all"
        >
          Rotate 90°  ({comp.rotation === 0 ? "Horizontal" : "Vertical"})
        </button>
      )}

      {/* Simulation results */}
      {(current !== null || vDiff !== null) && (
        <div className="flex flex-col gap-1 pt-2 border-t border-surface-border">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest">Probe</p>
          {vDiff !== null && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">V (pin0→pin1)</span>
              <span className="text-accent-amber font-mono">{vDiff.toFixed(4)} V</span>
            </div>
          )}
          {current !== null && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Current</span>
              <span className="text-accent-blue font-mono">{current.toExponential(3)} A</span>
            </div>
          )}
          {v0 !== null && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">V(pin0)</span>
              <span className="text-gray-300 font-mono">{v0.toFixed(4)} V</span>
            </div>
          )}
          {v1 !== null && (
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">V(pin1)</span>
              <span className="text-gray-300 font-mono">{v1.toFixed(4)} V</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
