import type { Component, Circuit } from "../types.js";
import type { Netlist } from "../graph.js";
import { nodeOfPin } from "../graph.js";
import { gaussianElim, zeroMatrix, zeroVec } from "./gauss.js";

export interface TransientState {
  voltages: Map<string, number>;
  currents: Map<string, number>;
}

export interface MNASolution {
  nodeVoltages: Map<string, number>;
  branchCurrents: Map<string, number>;
}

interface Complex {
  re: number;
  im: number;
}

interface ComplexSolution {
  nodeVoltages: Map<string, Complex>;
  branchCurrents: Map<string, Complex>;
}

export function emptyTransientState(): TransientState {
  return { voltages: new Map(), currents: new Map() };
}

function switchResistance(component: Component, timeSeconds: number | null) {
  const closeTime = Math.max(component.value, 0);
  const closed = timeSeconds === null ? closeTime <= 0 : timeSeconds >= closeTime;
  return closed ? 1e-4 : Number.POSITIVE_INFINITY;
}

function createVoltageSourceIndex(circuit: Circuit, transient: { state: TransientState; h: number } | null) {
  const voltageSources: Component[] = [];
  for (const component of circuit.components) {
    if (component.type === "voltage_source") voltageSources.push(component);
    if (component.type === "inductor" && transient === null) voltageSources.push(component);
  }
  return voltageSources;
}

export function solveMNA(
  circuit: Circuit,
  netlist: Netlist,
  transient: { state: TransientState; h: number; time: number } | null
): MNASolution | null {
  const { nodes, groundNodeId } = netlist;
  const nodeIdx = new Map<string, number>(nodes.map((id, index) => [id, index]));
  const voltageSources = createVoltageSourceIndex(circuit, transient);
  const vsIdx = new Map<string, number>(voltageSources.map((component, index) => [component.id, index]));

  const n = nodes.length;
  const m = voltageSources.length;
  const size = n + m;

  const A = zeroMatrix(size);
  const b = zeroVec(size);

  function stampG(nA: string | null, nB: string | null, g: number) {
    const ia = nA && nA !== groundNodeId ? nodeIdx.get(nA)! : -1;
    const ib = nB && nB !== groundNodeId ? nodeIdx.get(nB)! : -1;
    if (ia >= 0) A[ia][ia] += g;
    if (ib >= 0) A[ib][ib] += g;
    if (ia >= 0 && ib >= 0) {
      A[ia][ib] -= g;
      A[ib][ia] -= g;
    }
  }

  function stampI(nA: string | null, nB: string | null, i: number) {
    const ia = nA && nA !== groundNodeId ? nodeIdx.get(nA)! : -1;
    const ib = nB && nB !== groundNodeId ? nodeIdx.get(nB)! : -1;
    if (ia >= 0) b[ia] += i;
    if (ib >= 0) b[ib] -= i;
  }

  function stampVS(nP: string | null, nN: string | null, k: number, e: number) {
    const ip = nP && nP !== groundNodeId ? nodeIdx.get(nP)! : -1;
    const iq = nN && nN !== groundNodeId ? nodeIdx.get(nN)! : -1;
    const ik = n + k;
    if (ip >= 0) {
      A[ip][ik] += 1;
      A[ik][ip] += 1;
    }
    if (iq >= 0) {
      A[iq][ik] -= 1;
      A[ik][iq] -= 1;
    }
    b[ik] = e;
  }

  for (const component of circuit.components) {
    const nP = nodeOfPin(netlist, component.id, 0);
    const nN = nodeOfPin(netlist, component.id, 1);

    switch (component.type) {
      case "resistor":
      case "bulb":
        if (component.value !== 0) {
          stampG(nP, nN, 1 / component.value);
        }
        break;

      case "switch": {
        const resistance = switchResistance(component, transient?.time ?? null);
        if (Number.isFinite(resistance) && resistance > 0) {
          stampG(nP, nN, 1 / resistance);
        }
        break;
      }

      case "voltage_source":
        stampVS(nP, nN, vsIdx.get(component.id)!, component.value);
        break;

      case "current_source":
        stampI(nP, nN, component.value);
        break;

      case "capacitor":
        if (transient !== null) {
          const { state, h } = transient;
          const gEq = (2 * component.value) / h;
          const vPrev = state.voltages.get(component.id) ?? 0;
          const iPrev = state.currents.get(component.id) ?? 0;
          const iEq = iPrev + gEq * vPrev;
          stampG(nP, nN, gEq);
          stampI(nP, nN, iEq);
        }
        break;

      case "inductor":
        if (transient === null) {
          stampVS(nP, nN, vsIdx.get(component.id)!, 0);
        } else {
          const { state, h } = transient;
          const gEq = h / (2 * component.value);
          const vPrev = state.voltages.get(component.id) ?? 0;
          const iPrev = state.currents.get(component.id) ?? 0;
          const iEq = iPrev + gEq * vPrev;
          stampG(nP, nN, gEq);
          stampI(nP, nN, iEq);
        }
        break;

      case "ground":
        break;
    }
  }

  if (size === 0) {
    return { nodeVoltages: new Map(), branchCurrents: new Map() };
  }

  const x = gaussianElim(A, b);
  if (!x) return null;

  const nodeVoltages = new Map<string, number>();
  nodeVoltages.set(groundNodeId, 0);
  for (const [id, index] of nodeIdx) nodeVoltages.set(id, x[index]);

  const branchCurrents = new Map<string, number>();
  for (const component of circuit.components) {
    const nP = nodeOfPin(netlist, component.id, 0);
    const nN = nodeOfPin(netlist, component.id, 1);
    const vP = nP ? (nodeVoltages.get(nP) ?? 0) : 0;
    const vN = nN ? (nodeVoltages.get(nN) ?? 0) : 0;

    switch (component.type) {
      case "resistor":
      case "bulb":
        branchCurrents.set(component.id, component.value !== 0 ? (vP - vN) / component.value : 0);
        break;

      case "switch": {
        const resistance = switchResistance(component, transient?.time ?? null);
        branchCurrents.set(component.id, Number.isFinite(resistance) ? (vP - vN) / resistance : 0);
        break;
      }

      case "voltage_source":
        branchCurrents.set(component.id, x[n + vsIdx.get(component.id)!]);
        break;

      case "inductor":
        if (transient === null) {
          branchCurrents.set(component.id, x[n + vsIdx.get(component.id)!]);
        } else {
          const { state, h } = transient;
          const gEq = h / (2 * component.value);
          const vPrev = state.voltages.get(component.id) ?? 0;
          const iPrev = state.currents.get(component.id) ?? 0;
          branchCurrents.set(component.id, gEq * (vP - vN) + iPrev + gEq * vPrev);
        }
        break;

      case "current_source":
        branchCurrents.set(component.id, component.value);
        break;

      case "capacitor":
        if (transient === null) {
          branchCurrents.set(component.id, 0);
        } else {
          const { state, h } = transient;
          const gEq = (2 * component.value) / h;
          const vPrev = state.voltages.get(component.id) ?? 0;
          const iPrev = state.currents.get(component.id) ?? 0;
          branchCurrents.set(component.id, gEq * (vP - vN) - iPrev - gEq * vPrev);
        }
        break;

      default:
        break;
    }
  }

  return { nodeVoltages, branchCurrents };
}

export function solveACMNA(
  circuit: Circuit,
  netlist: Netlist,
  frequency: number
): ComplexSolution | null {
  const { nodes, groundNodeId } = netlist;
  const nodeIdx = new Map<string, number>(nodes.map((id, index) => [id, index]));
  const voltageSources = circuit.components.filter((component) => component.type === "voltage_source");
  const vsIdx = new Map<string, number>(voltageSources.map((component, index) => [component.id, index]));

  const n = nodes.length;
  const m = voltageSources.length;
  const size = n + m;
  const realSize = size * 2;

  const A = zeroMatrix(realSize);
  const b = zeroVec(realSize);
  const omega = 2 * Math.PI * Math.max(frequency, 1e-9);

  const realIndex = (index: number) => index;
  const imagIndex = (index: number) => index + size;

  function stampMatrix(r: number, c: number, value: Complex) {
    A[realIndex(r)][realIndex(c)] += value.re;
    A[realIndex(r)][imagIndex(c)] -= value.im;
    A[imagIndex(r)][realIndex(c)] += value.im;
    A[imagIndex(r)][imagIndex(c)] += value.re;
  }

  function stampComplexG(nA: string | null, nB: string | null, value: Complex) {
    const ia = nA && nA !== groundNodeId ? nodeIdx.get(nA)! : -1;
    const ib = nB && nB !== groundNodeId ? nodeIdx.get(nB)! : -1;
    if (ia >= 0) stampMatrix(ia, ia, value);
    if (ib >= 0) stampMatrix(ib, ib, value);
    if (ia >= 0 && ib >= 0) {
      stampMatrix(ia, ib, { re: -value.re, im: -value.im });
      stampMatrix(ib, ia, { re: -value.re, im: -value.im });
    }
  }

  function stampComplexI(nA: string | null, nB: string | null, value: Complex) {
    const ia = nA && nA !== groundNodeId ? nodeIdx.get(nA)! : -1;
    const ib = nB && nB !== groundNodeId ? nodeIdx.get(nB)! : -1;
    if (ia >= 0) {
      b[realIndex(ia)] += value.re;
      b[imagIndex(ia)] += value.im;
    }
    if (ib >= 0) {
      b[realIndex(ib)] -= value.re;
      b[imagIndex(ib)] -= value.im;
    }
  }

  function stampVS(nP: string | null, nN: string | null, k: number, voltage: Complex) {
    const ip = nP && nP !== groundNodeId ? nodeIdx.get(nP)! : -1;
    const iq = nN && nN !== groundNodeId ? nodeIdx.get(nN)! : -1;
    const ik = n + k;
    if (ip >= 0) {
      stampMatrix(ip, ik, { re: 1, im: 0 });
      stampMatrix(ik, ip, { re: 1, im: 0 });
    }
    if (iq >= 0) {
      stampMatrix(iq, ik, { re: -1, im: 0 });
      stampMatrix(ik, iq, { re: -1, im: 0 });
    }
    b[realIndex(ik)] = voltage.re;
    b[imagIndex(ik)] = voltage.im;
  }

  for (const component of circuit.components) {
    const nP = nodeOfPin(netlist, component.id, 0);
    const nN = nodeOfPin(netlist, component.id, 1);

    switch (component.type) {
      case "resistor":
      case "bulb":
        if (component.value !== 0) stampComplexG(nP, nN, { re: 1 / component.value, im: 0 });
        break;

      case "capacitor":
        stampComplexG(nP, nN, { re: 0, im: omega * component.value });
        break;

      case "inductor":
        if (component.value !== 0) {
          stampComplexG(nP, nN, { re: 0, im: -1 / (omega * component.value) });
        }
        break;

      case "voltage_source":
        stampVS(nP, nN, vsIdx.get(component.id)!, { re: component.value, im: 0 });
        break;

      case "current_source":
        stampComplexI(nP, nN, { re: component.value, im: 0 });
        break;

      case "ground":
        break;
    }
  }

  if (realSize === 0) {
    return { nodeVoltages: new Map(), branchCurrents: new Map() };
  }

  const x = gaussianElim(A, b);
  if (!x) return null;

  const nodeVoltages = new Map<string, Complex>();
  nodeVoltages.set(groundNodeId, { re: 0, im: 0 });
  for (const [id, index] of nodeIdx) {
    nodeVoltages.set(id, { re: x[realIndex(index)], im: x[imagIndex(index)] });
  }

  const branchCurrents = new Map<string, Complex>();
  for (const component of circuit.components) {
    const nP = nodeOfPin(netlist, component.id, 0);
    const nN = nodeOfPin(netlist, component.id, 1);
    const vP = nP ? nodeVoltages.get(nP) ?? { re: 0, im: 0 } : { re: 0, im: 0 };
    const vN = nN ? nodeVoltages.get(nN) ?? { re: 0, im: 0 } : { re: 0, im: 0 };
    const dv = { re: vP.re - vN.re, im: vP.im - vN.im };

    switch (component.type) {
      case "resistor":
      case "bulb":
        branchCurrents.set(component.id, {
          re: component.value !== 0 ? dv.re / component.value : 0,
          im: component.value !== 0 ? dv.im / component.value : 0,
        });
        break;

      case "capacitor":
        branchCurrents.set(component.id, {
          re: -omega * component.value * dv.im,
          im: omega * component.value * dv.re,
        });
        break;

      case "inductor":
        if (component.value !== 0) {
          const scale = -1 / (omega * component.value);
          branchCurrents.set(component.id, {
            re: -scale * dv.im,
            im: scale * dv.re,
          });
        }
        break;

      case "voltage_source":
        branchCurrents.set(component.id, {
          re: x[realIndex(n + vsIdx.get(component.id)!)],
          im: x[imagIndex(n + vsIdx.get(component.id)!)],
        });
        break;

      case "current_source":
        branchCurrents.set(component.id, { re: component.value, im: 0 });
        break;

      case "switch": {
        const resistance = switchResistance(component, null);
        branchCurrents.set(component.id, Number.isFinite(resistance)
          ? { re: dv.re / resistance, im: dv.im / resistance }
          : { re: 0, im: 0 });
        break;
      }

      default:
        break;
    }
  }

  return { nodeVoltages, branchCurrents };
}

export function magnitude(value: Complex) {
  return Math.hypot(value.re, value.im);
}
