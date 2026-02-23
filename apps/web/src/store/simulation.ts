/**
 * Simulation results & state.
 * Separate from circuit store so re-renders stay scoped.
 */

import { create } from "zustand";
import type { SimResult, DCResult, TransientResult } from "@circuitsim/engine";
import { simulate } from "@circuitsim/engine";
import type { Circuit, SimOptions } from "@circuitsim/engine";

export type SimStatus = "idle" | "running" | "done" | "error";

interface SimStore {
  status: SimStatus;
  result: SimResult | null;
  error: string | null;
  /** For transient: which frame is currently displayed */
  currentFrame: number;

  run: (circuit: Circuit, opts: SimOptions) => void;
  setFrame: (f: number) => void;
  reset: () => void;

  // Derived helpers
  getNodeVoltage: (nodeId: string) => number | null;
  getBranchCurrent: (componentId: string) => number | null;
}

export const useSimStore = create<SimStore>()((set, get) => ({
  status: "idle",
  result: null,
  error: null,
  currentFrame: 0,

  run(circuit, opts) {
    set({ status: "running", error: null });
    // Run in a microtask so UI can update first
    setTimeout(() => {
      try {
        const result = simulate(circuit, opts);
        if (!result.converged) {
          set({ status: "error", error: result.message, result: null });
        } else {
          set({ status: "done", result, currentFrame: 0 });
        }
      } catch (e) {
        set({ status: "error", error: String(e), result: null });
      }
    }, 0);
  },

  setFrame(f) { set({ currentFrame: f }); },
  reset() { set({ status: "idle", result: null, error: null, currentFrame: 0 }); },

  getNodeVoltage(nodeId) {
    const { result, currentFrame } = get();
    if (!result?.converged) return null;
    if (result.type === "dc") return (result as DCResult).nodeVoltages[nodeId] ?? null;
    const r = result as TransientResult;
    return r.frames[currentFrame]?.nodeVoltages[nodeId] ?? null;
  },

  getBranchCurrent(componentId) {
    const { result, currentFrame } = get();
    if (!result?.converged) return null;
    if (result.type === "dc") return (result as DCResult).branchCurrents[componentId] ?? null;
    const r = result as TransientResult;
    return r.frames[currentFrame]?.branchCurrents[componentId] ?? null;
  },
}));
