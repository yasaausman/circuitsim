import { useEffect, useState } from "react";
import { buildNetlist } from "@circuitsim/engine";
import { useCircuitStore } from "../../store/circuit";
import { useSimStore } from "../../store/simulation";

const UNITS: Record<string, string> = {
  resistor: "ohms",
  capacitor: "F",
  inductor: "H",
  voltage_source: "V",
  current_source: "A",
  switch: "s",
  bulb: "ohms",
  ground: "",
};

function formatPower(value: number | null) {
  if (value === null) return null;
  if (Math.abs(value) < 1e-3) return `${(value * 1e6).toFixed(2)} uW`;
  if (Math.abs(value) < 1) return `${(value * 1e3).toFixed(2)} mW`;
  return `${value.toFixed(3)} W`;
}

export function PropertyPanel() {
  const { circuit, selectedId, updateComponent } = useCircuitStore();
  const { getNodeVoltage, getBranchCurrent, getComponentPower } = useSimStore();

  const component = circuit.components.find((item) => item.id === selectedId);
  const [editValue, setEditValue] = useState("");
  const [editLabel, setEditLabel] = useState("");

  useEffect(() => {
    if (!component) return;
    setEditValue(String(component.value));
    setEditLabel(component.label ?? "");
  }, [component?.id, component?.value, component?.label]);

  if (!component) {
    return (
      <div className="p-4">
        <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-slate-500">Properties</p>
        <p className="text-sm text-slate-500">Select a component to inspect its values, currents, and power.</p>
      </div>
    );
  }

  const selectedComponent = component;

  const netlist = buildNetlist(circuit.components, circuit.wires);
  const node0 = netlist.terminalToNode.get(`${selectedComponent.id}:0`) ?? null;
  const node1 = netlist.terminalToNode.get(`${selectedComponent.id}:1`) ?? null;
  const v0 = node0 ? getNodeVoltage(node0) : null;
  const v1 = node1 ? getNodeVoltage(node1) : null;
  const voltageDrop = v0 !== null && v1 !== null ? v0 - v1 : null;
  const current = getBranchCurrent(selectedComponent.id);
  const power = getComponentPower(selectedComponent.id);

  function commitValue() {
    const numeric = parseFloat(editValue);
    if (!Number.isNaN(numeric) && numeric >= 0) {
      updateComponent(selectedComponent.id, { value: numeric });
    }
  }

  function commitLabel() {
    updateComponent(selectedComponent.id, { label: editLabel });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Properties</p>

      <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Type</span>
          <span className="capitalize text-slate-700">{selectedComponent.type.replace("_", " ")}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-slate-500">ID</span>
          <span className="max-w-[120px] truncate font-mono text-xs text-slate-500">{selectedComponent.id}</span>
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-500">Label</span>
        <input
          value={editLabel}
          onChange={(event) => setEditLabel(event.target.value)}
          onBlur={commitLabel}
          onKeyDown={(event) => event.key === "Enter" && commitLabel()}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-800 outline-none transition focus:border-emerald-400"
        />
      </label>

      {selectedComponent.type !== "ground" && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-500">
            {selectedComponent.type === "switch"
              ? "Close time (s)"
              : `Value (${UNITS[selectedComponent.type]})`}
          </span>
          <input
            value={editValue}
            onChange={(event) => setEditValue(event.target.value)}
            onBlur={commitValue}
            onKeyDown={(event) => event.key === "Enter" && commitValue()}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-800 outline-none transition focus:border-sky-400"
          />
        </label>
      )}

      {selectedComponent.type !== "ground" && (
        <button
          onClick={() =>
            updateComponent(selectedComponent.id, { rotation: selectedComponent.rotation === 0 ? 1 : 0 })
          }
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Rotate 90 degrees ({selectedComponent.rotation === 0 ? "Horizontal" : "Vertical"})
        </button>
      )}

      {(current !== null || voltageDrop !== null || power !== null) && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/90 p-3">
          <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-amber-700">Measurement</p>
          {voltageDrop !== null && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Voltage drop</span>
              <span className="font-mono text-amber-700">{voltageDrop.toFixed(4)} V</span>
            </div>
          )}
          {current !== null && (
            <div className="mt-1 flex justify-between text-sm">
              <span className="text-slate-500">Current</span>
              <span className="font-mono text-sky-700">{current.toExponential(3)} A</span>
            </div>
          )}
          {power !== null && (
            <div className="mt-1 flex justify-between text-sm">
              <span className="text-slate-500">Power</span>
              <span className="font-mono text-rose-700">{formatPower(power)}</span>
            </div>
          )}
          {v0 !== null && (
            <div className="mt-1 flex justify-between text-sm">
              <span className="text-slate-500">Pin 0</span>
              <span className="font-mono text-slate-700">{v0.toFixed(4)} V</span>
            </div>
          )}
          {v1 !== null && (
            <div className="mt-1 flex justify-between text-sm">
              <span className="text-slate-500">Pin 1</span>
              <span className="font-mono text-slate-700">{v1.toFixed(4)} V</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
