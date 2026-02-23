/**
 * Top-level simulation entry point.
 * Accepts a Circuit + SimOptions, returns a SimResult.
 */

import type { Circuit, SimOptions, SimResult, DCResult, TransientResult } from "../types.js";
import { buildNetlist, nodeOfPin } from "../graph.js";
import {
  solveMNA,
  emptyTransientState,
  type TransientState,
} from "./mna.js";

export function simulate(circuit: Circuit, opts: SimOptions): SimResult {
  const netlist = buildNetlist(circuit.components, circuit.wires);

  if (opts.type === "dc") {
    const sol = solveMNA(circuit, netlist, null);
    if (!sol) return { converged: false, message: "Singular matrix – check for floating nodes or short circuits." };

    const nodeVoltages: DCResult["nodeVoltages"] = {};
    for (const [k, v] of sol.nodeVoltages) nodeVoltages[k] = v;

    const branchCurrents: DCResult["branchCurrents"] = {};
    for (const [k, v] of sol.branchCurrents) branchCurrents[k] = v;

    return { type: "dc", nodeVoltages, branchCurrents, converged: true };
  }

  // ── Transient ─────────────────────────────────────────────────────────────
  const { stepSize: h = 1e-4, stopTime = 1e-2 } = opts;
  const maxSteps = Math.ceil(stopTime / h);

  const state: TransientState = emptyTransientState();

  // Initialise state from DC operating point
  const dcSol = solveMNA(circuit, netlist, null);
  if (dcSol) {
    for (const c of circuit.components) {
      const nP = nodeOfPin(netlist, c.id, 0);
      const nN = nodeOfPin(netlist, c.id, 1);
      const vP = nP ? (dcSol.nodeVoltages.get(nP) ?? 0) : 0;
      const vN = nN ? (dcSol.nodeVoltages.get(nN) ?? 0) : 0;
      state.voltages.set(c.id, vP - vN);
      state.currents.set(c.id, dcSol.branchCurrents.get(c.id) ?? 0);
    }
  }

  const frames: TransientResult["frames"] = [];

  for (let step = 0; step <= maxSteps; step++) {
    const time = step * h;
    const sol = solveMNA(circuit, netlist, { state, h });
    if (!sol) return { converged: false, message: `Singular matrix at t=${time.toExponential(3)}s` };

    const nodeVoltages: Record<string, number> = {};
    for (const [k, v] of sol.nodeVoltages) nodeVoltages[k] = v;

    const branchCurrents: Record<string, number> = {};
    for (const [k, v] of sol.branchCurrents) branchCurrents[k] = v;

    frames.push({ time, nodeVoltages, branchCurrents });

    // Update state for next step (trapezoidal predictor)
    for (const c of circuit.components) {
      const nP = nodeOfPin(netlist, c.id, 0);
      const nN = nodeOfPin(netlist, c.id, 1);
      const vP = nP ? (sol.nodeVoltages.get(nP) ?? 0) : 0;
      const vN = nN ? (sol.nodeVoltages.get(nN) ?? 0) : 0;
      state.voltages.set(c.id, vP - vN);
      state.currents.set(c.id, sol.branchCurrents.get(c.id) ?? 0);
    }
  }

  return { type: "transient", frames, converged: true };
}
