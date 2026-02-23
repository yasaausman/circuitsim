/**
 * Modified Nodal Analysis (MNA) matrix builder.
 *
 * System equation:   [G  B] [v]   [i_s]
 *                    [C  D] [j] = [e_s]
 *
 *   n  = number of non-ground nodes
 *   m  = number of independent voltage sources
 *       (+ inductors treated as V-sources in DC mode)
 *
 * Matrix size: (n + m) × (n + m)
 *
 * Transient companion models (trapezoidal method):
 *   Capacitor C with step h:   Geq = 2C/h,  Ieq = i_C(t) + 2C/h · v_C(t)
 *   Inductor  L with step h:   Geq = h/2L,  Ieq = i_L(t) + h/2L · v_L(t)
 */

import type { Component, Circuit } from "../types.js";
import type { Netlist } from "../graph.js";
import { nodeOfPin } from "../graph.js";
import { gaussianElim, zeroMatrix, zeroVec } from "./gauss.js";

// ─── State carried between transient time steps ───────────────────────────────

export interface TransientState {
  /** componentId → voltage across it at previous step */
  voltages: Map<string, number>;
  /** componentId → current through it at previous step */
  currents: Map<string, number>;
}

export function emptyTransientState(): TransientState {
  return { voltages: new Map(), currents: new Map() };
}

// ─── Solve one MNA step ───────────────────────────────────────────────────────

export interface MNASolution {
  /** nodeId → voltage */
  nodeVoltages: Map<string, number>;
  /** componentId → current (positive = flows pin0 → pin1) */
  branchCurrents: Map<string, number>;
}

/**
 * Build and solve one MNA matrix for the given circuit.
 *
 * @param transient  If provided, capacitors/inductors use companion models.
 *                   If null, DC mode: caps are open, inductors are V=0 sources.
 */
export function solveMNA(
  circuit: Circuit,
  netlist: Netlist,
  transient: { state: TransientState; h: number } | null
): MNASolution | null {
  const { nodes, groundNodeId } = netlist;
  const n = nodes.length;

  // Index of non-ground nodes in the matrix
  const nodeIdx = new Map<string, number>(nodes.map((id, i) => [id, i]));

  // Identify voltage sources (and inductors in DC mode that act as V=0 sources)
  const voltageSources: Component[] = [];
  for (const c of circuit.components) {
    if (c.type === "voltage_source") voltageSources.push(c);
    if (c.type === "inductor" && transient === null) voltageSources.push(c);
  }
  const m = voltageSources.length;
  const vsIdx = new Map<string, number>(
    voltageSources.map((c, i) => [c.id, i])
  );

  const size = n + m;
  const A = zeroMatrix(size);
  const b = zeroVec(size);

  // ── Helper: add conductance between two nodes ────────────────────────────
  function stampG(nA: string | null, nB: string | null, g: number) {
    const ia = nA && nA !== groundNodeId ? nodeIdx.get(nA)! : -1;
    const ib = nB && nB !== groundNodeId ? nodeIdx.get(nB)! : -1;
    if (ia >= 0) A[ia][ia] += g;
    if (ib >= 0) A[ib][ib] += g;
    if (ia >= 0 && ib >= 0) { A[ia][ib] -= g; A[ib][ia] -= g; }
  }

  // ── Helper: inject current into node nA from nB ──────────────────────────
  function stampI(nA: string | null, nB: string | null, i: number) {
    const ia = nA && nA !== groundNodeId ? nodeIdx.get(nA)! : -1;
    const ib = nB && nB !== groundNodeId ? nodeIdx.get(nB)! : -1;
    if (ia >= 0) b[ia] += i;
    if (ib >= 0) b[ib] -= i;
  }

  // ── Helper: stamp a voltage source (V from nN to nP = e) ────────────────
  function stampVS(nP: string | null, nN: string | null, k: number, e: number) {
    const ip = nP && nP !== groundNodeId ? nodeIdx.get(nP)! : -1;
    const iq = nN && nN !== groundNodeId ? nodeIdx.get(nN)! : -1;
    const ik = n + k;
    if (ip >= 0) { A[ip][ik] += 1; A[ik][ip] += 1; }
    if (iq >= 0) { A[iq][ik] -= 1; A[ik][iq] -= 1; }
    b[ik] = e;
  }

  // ── Stamp each component ─────────────────────────────────────────────────
  for (const c of circuit.components) {
    const nP = nodeOfPin(netlist, c.id, 0); // positive / pin 0
    const nN = nodeOfPin(netlist, c.id, 1); // negative / pin 1

    switch (c.type) {
      case "resistor":
      case "bulb": {
        if (c.value === 0) break; // ideal short
        stampG(nP, nN, 1 / c.value);
        break;
      }

      case "voltage_source": {
        const k = vsIdx.get(c.id)!;
        stampVS(nP, nN, k, c.value);
        break;
      }

      case "current_source": {
        // Current flows from nN into nP (conventional: from − to +)
        stampI(nP, nN, c.value);
        break;
      }

      case "capacitor": {
        if (transient === null) break; // DC: open circuit
        const { state, h } = transient;
        const Geq = (2 * c.value) / h;
        const vPrev = state.voltages.get(c.id) ?? 0;
        const iPrev = state.currents.get(c.id) ?? 0;
        const Ieq = iPrev + Geq * vPrev;
        stampG(nP, nN, Geq);
        stampI(nP, nN, Ieq); // history current source
        break;
      }

      case "inductor": {
        if (transient === null) {
          // DC: short circuit = voltage source V=0
          const k = vsIdx.get(c.id)!;
          stampVS(nP, nN, k, 0);
        } else {
          const { state, h } = transient;
          const Geq = h / (2 * c.value);
          const vPrev = state.voltages.get(c.id) ?? 0;
          const iPrev = state.currents.get(c.id) ?? 0;
          const Ieq = iPrev + Geq * vPrev;
          stampG(nP, nN, Geq);
          stampI(nP, nN, Ieq);
        }
        break;
      }

      case "ground":
        break; // defines reference node, no stamps needed
    }
  }

  // ── Solve ────────────────────────────────────────────────────────────────
  if (size === 0) {
    return { nodeVoltages: new Map(), branchCurrents: new Map() };
  }

  const x = gaussianElim(A, b);
  if (!x) return null; // singular matrix

  // ── Extract results ───────────────────────────────────────────────────────
  const nodeVoltages = new Map<string, number>();
  nodeVoltages.set(groundNodeId, 0);
  for (const [id, idx] of nodeIdx) nodeVoltages.set(id, x[idx]);

  const branchCurrents = new Map<string, number>();
  for (const c of circuit.components) {
    const nP = nodeOfPin(netlist, c.id, 0);
    const nN = nodeOfPin(netlist, c.id, 1);
    const vP = nP ? (nodeVoltages.get(nP) ?? 0) : 0;
    const vN = nN ? (nodeVoltages.get(nN) ?? 0) : 0;

    switch (c.type) {
      case "resistor":
      case "bulb":
        branchCurrents.set(c.id, c.value !== 0 ? (vP - vN) / c.value : 0);
        break;
      case "voltage_source": {
        // current is the extra variable j[k] in the solution vector
        const k = vsIdx.get(c.id)!;
        branchCurrents.set(c.id, x[n + k]);
        break;
      }
      case "inductor": {
        if (transient === null) {
          // DC: inductor is a V=0 voltage source; current lives in vsIdx
          const k = vsIdx.get(c.id)!;
          branchCurrents.set(c.id, x[n + k]);
        } else {
          // Transient companion model: i_L(t) = Geq*(vP-vN) + Ieq
          // where Ieq = i_L(t-1) + Geq*v_L(t-1)
          const { state, h } = transient;
          const Geq = h / (2 * c.value);
          const vPrev = state.voltages.get(c.id) ?? 0;
          const iPrev = state.currents.get(c.id) ?? 0;
          branchCurrents.set(c.id, Geq * (vP - vN) + iPrev + Geq * vPrev);
        }
        break;
      }
      case "current_source":
        branchCurrents.set(c.id, c.value);
        break;
      case "capacitor": {
        if (transient === null) {
          branchCurrents.set(c.id, 0);
        } else {
          const { state, h } = transient;
          const Geq = (2 * c.value) / h;
          const vPrev = state.voltages.get(c.id) ?? 0;
          const iPrev = state.currents.get(c.id) ?? 0;
          const iNow = Geq * (vP - vN) - iPrev - Geq * vPrev;
          branchCurrents.set(c.id, iNow);
        }
        break;
      }
      default:
        break;
    }
  }

  return { nodeVoltages, branchCurrents };
}
