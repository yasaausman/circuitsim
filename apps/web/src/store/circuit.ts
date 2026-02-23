/**
 * Primary circuit state — persisted to localStorage.
 * All mutation helpers live here so the 3D canvas and UI stay in sync.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Circuit,
  Component,
  ComponentType,
  Wire,
  Vec3,
} from "@circuitsim/engine";

let _idCounter = 0;
const uid = (prefix: string) => `${prefix}_${++_idCounter}_${Date.now().toString(36)}`;

// ─── Tool mode ────────────────────────────────────────────────────────────────

export type ToolMode =
  | { type: "select" }
  | { type: "place"; componentType: ComponentType }
  | { type: "wire"; fromComponentId?: string; fromPinIndex?: 0 | 1 }
  | { type: "probe" }
  | { type: "delete" };

// ─── Store shape ──────────────────────────────────────────────────────────────

export interface CircuitStore {
  circuit: Circuit;
  selectedId: string | null;
  tool: ToolMode;

  // Circuit mutations
  addComponent: (type: ComponentType, value: number, position: Vec3, rotation?: 0 | 1, label?: string) => string;
  updateComponent: (id: string, patch: Partial<Component>) => void;
  removeComponent: (id: string) => void;
  addWire: (fromComponentId: string, fromPinIndex: 0 | 1, toComponentId: string, toPinIndex: 0 | 1) => string;
  removeWire: (id: string) => void;
  clearCircuit: () => void;
  loadCircuit: (c: Circuit) => void;

  // Selection & tool
  select: (id: string | null) => void;
  setTool: (t: ToolMode) => void;
}

const EMPTY_CIRCUIT: Circuit = {
  id: uid("circuit"),
  name: "Untitled Circuit",
  components: [],
  wires: [],
};

export const useCircuitStore = create<CircuitStore>()(
  persist(
    (set, get) => ({
      circuit: EMPTY_CIRCUIT,
      selectedId: null,
      tool: { type: "select" },

      addComponent(type, value, position, rotation = 0, label) {
        const id = uid(type);
        const component: Component = {
          id, type, value,
          position,
          rotation,
          ...(label ? { label } : {}),
        };
        set((s) => ({
          circuit: {
            ...s.circuit,
            components: [...s.circuit.components, component],
          },
        }));
        return id;
      },

      updateComponent(id, patch) {
        set((s) => ({
          circuit: {
            ...s.circuit,
            components: s.circuit.components.map((c) =>
              c.id === id ? { ...c, ...patch } : c
            ),
          },
        }));
      },

      removeComponent(id) {
        set((s) => ({
          circuit: {
            ...s.circuit,
            components: s.circuit.components.filter((c) => c.id !== id),
            // Remove any wires connected to this component
            wires: s.circuit.wires.filter(
              (w) => w.fromComponentId !== id && w.toComponentId !== id
            ),
          },
        }));
      },

      addWire(fromComponentId, fromPinIndex, toComponentId, toPinIndex) {
        // Prevent duplicate wires — check both directions since A→B and B→A
        // are the same electrical connection and would double-stamp the MNA matrix
        const existing = get().circuit.wires.find(
          (w) =>
            (w.fromComponentId === fromComponentId &&
              w.fromPinIndex === fromPinIndex &&
              w.toComponentId === toComponentId &&
              w.toPinIndex === toPinIndex) ||
            (w.fromComponentId === toComponentId &&
              w.fromPinIndex === toPinIndex &&
              w.toComponentId === fromComponentId &&
              w.toPinIndex === fromPinIndex)
        );
        if (existing) return existing.id;

        const id = uid("wire");
        const wire: Wire = { id, fromComponentId, fromPinIndex, toComponentId, toPinIndex };
        set((s) => ({
          circuit: { ...s.circuit, wires: [...s.circuit.wires, wire] },
        }));
        return id;
      },

      removeWire(id) {
        set((s) => ({
          circuit: {
            ...s.circuit,
            wires: s.circuit.wires.filter((w) => w.id !== id),
          },
        }));
      },

      clearCircuit() {
        set({ circuit: { ...EMPTY_CIRCUIT, id: uid("circuit") } });
      },

      loadCircuit(c) {
        set({ circuit: c, selectedId: null });
      },

      select(id) { set({ selectedId: id }); },
      setTool(t) { set({ tool: t }); },
    }),
    {
      name: "circuitsim-circuit",
      partialize: (s) => ({ circuit: s.circuit }),
    }
  )
);
