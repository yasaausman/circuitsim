import type {
  ACResult,
  Circuit,
  DCResult,
  SimResult,
  TransientResult,
} from "../types.js";
import { buildNetlist, nodeOfPin } from "../graph.js";
import { computeComponentPowers, diagnoseCircuit } from "../analysis.js";
import {
  emptyTransientState,
  magnitude,
  solveACMNA,
  solveMNA,
  type TransientState,
} from "./mna.js";

function solverError(message: string, circuit: Circuit): SimResult {
  return {
    converged: false,
    message,
    warnings: [
      ...diagnoseCircuit(circuit),
      {
        id: `solver:${Date.now()}`,
        kind: "solver",
        severity: "error",
        title: "Solver failed",
        message,
      },
    ],
  };
}

export function simulate(circuit: Circuit, opts: import("../types.js").SimOptions): SimResult {
  const netlist = buildNetlist(circuit.components, circuit.wires);
  const warnings = diagnoseCircuit(circuit);

  if (opts.type === "dc") {
    const solution = solveMNA(circuit, netlist, null);
    if (!solution) {
      return solverError("Singular matrix; check for floating nodes, missing ground, or short circuits.", circuit);
    }

    const nodeVoltages: DCResult["nodeVoltages"] = {};
    for (const [nodeId, voltage] of solution.nodeVoltages) nodeVoltages[nodeId] = voltage;

    const branchCurrents: DCResult["branchCurrents"] = {};
    for (const [componentId, current] of solution.branchCurrents) branchCurrents[componentId] = current;

    return {
      type: "dc",
      nodeVoltages,
      branchCurrents,
      componentPowers: computeComponentPowers(circuit, nodeVoltages, branchCurrents, null),
      warnings,
      converged: true,
    };
  }

  if (opts.type === "ac") {
    const solution = solveACMNA(circuit, netlist, opts.frequency);
    if (!solution) {
      return solverError(`AC solve failed at ${opts.frequency} Hz.`, circuit);
    }

    const nodeVoltages: ACResult["nodeVoltages"] = {};
    for (const [nodeId, voltage] of solution.nodeVoltages) {
      nodeVoltages[nodeId] = magnitude(voltage);
    }

    const branchCurrents: ACResult["branchCurrents"] = {};
    for (const [componentId, current] of solution.branchCurrents) {
      branchCurrents[componentId] = magnitude(current);
    }

    return {
      type: "ac",
      frequency: opts.frequency,
      nodeVoltages,
      branchCurrents,
      componentPowers: computeComponentPowers(circuit, nodeVoltages, branchCurrents, null),
      warnings,
      converged: true,
    };
  }

  const stepSize = opts.stepSize || 1e-4;
  const stopTime = opts.stopTime || 1e-2;
  const maxSteps = Math.ceil(stopTime / stepSize);
  const state: TransientState = emptyTransientState();

  const dcSolution = solveMNA(circuit, netlist, null);
  if (dcSolution) {
    for (const component of circuit.components) {
      const nP = nodeOfPin(netlist, component.id, 0);
      const nN = nodeOfPin(netlist, component.id, 1);
      const vP = nP ? (dcSolution.nodeVoltages.get(nP) ?? 0) : 0;
      const vN = nN ? (dcSolution.nodeVoltages.get(nN) ?? 0) : 0;
      state.voltages.set(component.id, vP - vN);
      state.currents.set(component.id, dcSolution.branchCurrents.get(component.id) ?? 0);
    }
  }

  const frames: TransientResult["frames"] = [];
  for (let step = 0; step <= maxSteps; step += 1) {
    const time = step * stepSize;
    const solution = solveMNA(circuit, netlist, { state, h: stepSize, time });
    if (!solution) {
      return solverError(`Transient solve failed at t=${time.toExponential(3)}s.`, circuit);
    }

    const nodeVoltages: Record<string, number> = {};
    for (const [nodeId, voltage] of solution.nodeVoltages) nodeVoltages[nodeId] = voltage;

    const branchCurrents: Record<string, number> = {};
    for (const [componentId, current] of solution.branchCurrents) branchCurrents[componentId] = current;

    frames.push({
      time,
      nodeVoltages,
      branchCurrents,
      componentPowers: computeComponentPowers(circuit, nodeVoltages, branchCurrents, time),
    });

    for (const component of circuit.components) {
      const nP = nodeOfPin(netlist, component.id, 0);
      const nN = nodeOfPin(netlist, component.id, 1);
      const vP = nP ? (solution.nodeVoltages.get(nP) ?? 0) : 0;
      const vN = nN ? (solution.nodeVoltages.get(nN) ?? 0) : 0;
      state.voltages.set(component.id, vP - vN);
      state.currents.set(component.id, solution.branchCurrents.get(component.id) ?? 0);
    }
  }

  const componentPowers = frames[frames.length - 1]?.componentPowers ?? {};
  return {
    type: "transient",
    frames,
    componentPowers,
    warnings,
    converged: true,
  };
}
