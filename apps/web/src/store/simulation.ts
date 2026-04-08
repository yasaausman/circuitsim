import { create } from "zustand";
import { simulate } from "@circuitsim/engine";
import type {
  ACResult,
  Circuit,
  DCResult,
  SimOptions,
  SimResult,
  TransientResult,
} from "@circuitsim/engine";

export type SimStatus = "idle" | "running" | "done" | "error";

interface SimStore {
  status: SimStatus;
  result: SimResult | null;
  error: string | null;
  currentFrame: number;
  autoplay: boolean;

  run: (circuit: Circuit, options: SimOptions) => void;
  setFrame: (frame: number) => void;
  setAutoplay: (value: boolean) => void;
  reset: () => void;

  getNodeVoltage: (nodeId: string) => number | null;
  getBranchCurrent: (componentId: string) => number | null;
  getComponentPower: (componentId: string) => number | null;
}

function getActiveResult(result: SimResult | null, currentFrame: number) {
  if (!result?.converged) return null;
  if (result.type === "transient") {
    const transient = result as TransientResult;
    return transient.frames[currentFrame] ?? transient.frames[0] ?? null;
  }
  return result as DCResult | ACResult;
}

export const useSimStore = create<SimStore>()((set, get) => ({
  status: "idle",
  result: null,
  error: null,
  currentFrame: 0,
  autoplay: false,

  run(circuit, options) {
    set({ status: "running", error: null, autoplay: false });
    setTimeout(() => {
      try {
        const result = simulate(circuit, options);
        if (!result.converged) {
          set({
            status: "error",
            error: result.message,
            result,
            currentFrame: 0,
          });
        } else {
          set({
            status: "done",
            result,
            error: null,
            currentFrame: 0,
            autoplay: false,
          });
        }
      } catch (error) {
        set({
          status: "error",
          error: String(error),
          result: null,
          currentFrame: 0,
          autoplay: false,
        });
      }
    }, 0);
  },

  setFrame(frame) {
    set({ currentFrame: frame });
  },

  setAutoplay(value) {
    set({ autoplay: value });
  },

  reset() {
    set({
      status: "idle",
      result: null,
      error: null,
      currentFrame: 0,
      autoplay: false,
    });
  },

  getNodeVoltage(nodeId) {
    const active = getActiveResult(get().result, get().currentFrame);
    if (!active) return null;
    return active.nodeVoltages[nodeId] ?? null;
  },

  getBranchCurrent(componentId) {
    const active = getActiveResult(get().result, get().currentFrame);
    if (!active) return null;
    return active.branchCurrents[componentId] ?? null;
  },

  getComponentPower(componentId) {
    const { result, currentFrame } = get();
    if (!result?.converged) return null;
    if (result.type === "transient") {
      return result.frames[currentFrame]?.componentPowers[componentId] ?? null;
    }
    return result.componentPowers[componentId] ?? null;
  },
}));
