import { buildNetlist, nodeOfPin, terminalId } from "./graph.js";
import type {
  AnalysisWarning,
  Circuit,
  Component,
} from "./types.js";

function warningId(prefix: string, key: string) {
  return `${prefix}:${key}`;
}

function componentName(component: Component) {
  return component.label?.trim() || component.id;
}

function switchResistance(component: Component, timeSeconds: number | null) {
  const closeTime = Math.max(component.value, 0);
  const closed = timeSeconds === null ? closeTime <= 0 : timeSeconds >= closeTime;
  return closed ? 1e-4 : Number.POSITIVE_INFINITY;
}

export function diagnoseCircuit(circuit: Circuit): AnalysisWarning[] {
  const warnings: AnalysisWarning[] = [];
  const netlist = buildNetlist(circuit.components, circuit.wires);
  const wireTouches = new Set<string>();
  const nodeToComponents = new Map<string, Set<string>>();
  const groundedComponents = findGroundedComponents(circuit, netlist);

  for (const wire of circuit.wires) {
    wireTouches.add(terminalId(wire.fromComponentId, wire.fromPinIndex));
    wireTouches.add(terminalId(wire.toComponentId, wire.toPinIndex));
  }

  for (const component of circuit.components) {
    const pinCount = component.type === "ground" ? 1 : 2;
    for (let pinIndex = 0; pinIndex < pinCount; pinIndex += 1) {
      const nodeId = nodeOfPin(netlist, component.id, pinIndex);
      if (!nodeId) continue;
      const set = nodeToComponents.get(nodeId) ?? new Set<string>();
      set.add(component.id);
      nodeToComponents.set(nodeId, set);
    }
  }

  if (!circuit.components.some((component) => component.type === "ground")) {
    warnings.push({
      id: warningId("missing_ground", circuit.id),
      kind: "missing_ground",
      severity: "error",
      title: "Missing ground",
      message: "Add at least one ground component so the solver has a reference node.",
    });
  }

  for (const component of circuit.components) {
    const pinCount = component.type === "ground" ? 1 : 2;
    const touchedPins = Array.from({ length: pinCount }, (_, pinIndex) =>
      wireTouches.has(terminalId(component.id, pinIndex))
    );

    if (component.type !== "ground" && touchedPins.some((touched) => !touched)) {
      warnings.push({
        id: warningId("open_circuit", component.id),
        kind: "open_circuit",
        severity: "warning",
        title: "Open terminal",
        message: `${componentName(component)} has at least one pin that is not connected to a wire.`,
        componentId: component.id,
      });
    }

    if (component.type !== "ground") {
      const node0 = nodeOfPin(netlist, component.id, 0);
      const node1 = nodeOfPin(netlist, component.id, 1);
      if (node0 && node1 && node0 === node1) {
        warnings.push({
          id: warningId("short_circuit", component.id),
          kind: "short_circuit",
          severity: component.type === "voltage_source" ? "error" : "warning",
          title: "Shorted component",
          message: `${componentName(component)} has both terminals tied to the same node.`,
          componentId: component.id,
          nodeId: node0,
        });
      }
    }

    if (component.type !== "ground") {
      if (!groundedComponents.has(component.id) && touchedPins.every(Boolean)) {
        warnings.push({
          id: warningId("floating_component", component.id),
          kind: "floating_component",
          severity: "info",
          title: "Floating island",
          message: `${componentName(component)} is connected, but not obviously tied to ground.`,
          componentId: component.id,
        });
      }
    }
  }

  return dedupeWarnings(warnings);
}

function findGroundedComponents(circuit: Circuit, netlist: ReturnType<typeof buildNetlist>) {
  const visitedNodes = new Set<string>();
  const visitedComponents = new Set<string>();
  const queue: Array<{ kind: "node" | "component"; id: string }> = [
    { kind: "node", id: netlist.groundNodeId },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.kind === "node") {
      if (visitedNodes.has(current.id)) continue;
      visitedNodes.add(current.id);

      for (const component of circuit.components) {
        const pinCount = component.type === "ground" ? 1 : 2;
        for (let pinIndex = 0; pinIndex < pinCount; pinIndex += 1) {
          const nodeId = nodeOfPin(netlist, component.id, pinIndex);
          if (nodeId === current.id && !visitedComponents.has(component.id)) {
            queue.push({ kind: "component", id: component.id });
            break;
          }
        }
      }
    } else {
      if (visitedComponents.has(current.id)) continue;
      visitedComponents.add(current.id);

      const component = circuit.components.find((item) => item.id === current.id);
      if (!component) continue;
      const pinCount = component.type === "ground" ? 1 : 2;
      for (let pinIndex = 0; pinIndex < pinCount; pinIndex += 1) {
        const nodeId = nodeOfPin(netlist, component.id, pinIndex);
        if (nodeId && !visitedNodes.has(nodeId)) {
          queue.push({ kind: "node", id: nodeId });
        }
      }
    }
  }

  return visitedComponents;
}

function dedupeWarnings(warnings: AnalysisWarning[]) {
  const byId = new Map<string, AnalysisWarning>();
  for (const warning of warnings) {
    if (!byId.has(warning.id)) {
      byId.set(warning.id, warning);
    }
  }
  return [...byId.values()];
}

export function computeComponentPowers(
  circuit: Circuit,
  nodeVoltages: Record<string, number>,
  branchCurrents: Record<string, number>,
  timeSeconds: number | null = null
) {
  const netlist = buildNetlist(circuit.components, circuit.wires);
  const powers: Record<string, number> = {};

  for (const component of circuit.components) {
    const node0 = nodeOfPin(netlist, component.id, 0);
    const node1 = component.type === "ground" ? null : nodeOfPin(netlist, component.id, 1);
    const v0 = node0 ? nodeVoltages[node0] ?? 0 : 0;
    const v1 = node1 ? nodeVoltages[node1] ?? 0 : 0;
    const voltageDrop = v0 - v1;
    const current = branchCurrents[component.id] ?? 0;

    if (component.type === "resistor" || component.type === "bulb") {
      powers[component.id] = Math.pow(current, 2) * Math.max(component.value, 0);
    } else if (component.type === "switch") {
      const resistance = switchResistance(component, timeSeconds);
      powers[component.id] = Number.isFinite(resistance) ? Math.pow(current, 2) * resistance : 0;
    } else {
      powers[component.id] = voltageDrop * current;
    }
  }

  return powers;
}

export function exportSpiceNetlist(circuit: Circuit) {
  const netlist = buildNetlist(circuit.components, circuit.wires);

  const nodeName = (nodeId: string | null) =>
    !nodeId || nodeId === netlist.groundNodeId ? "0" : nodeId.replace(/[^a-zA-Z0-9_]/g, "_");

  return circuit.components
    .filter((component) => component.type !== "ground")
    .map((component) => {
      const node0 = nodeName(nodeOfPin(netlist, component.id, 0));
      const node1 = nodeName(nodeOfPin(netlist, component.id, 1));
      const ref = component.label?.trim() || component.id;
      const prefix =
        component.type === "resistor" ? "R" :
        component.type === "capacitor" ? "C" :
        component.type === "inductor" ? "L" :
        component.type === "voltage_source" ? "V" :
        component.type === "current_source" ? "I" :
        component.type === "switch" ? "S" :
        "X";

      return `${prefix}${ref} ${node0} ${node1} ${component.value}`;
    })
    .join("\n");
}
