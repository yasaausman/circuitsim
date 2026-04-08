import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Circuit,
  Component,
  ComponentType,
  Wire,
  Vec3,
} from "@circuitsim/engine";

let idCounter = 0;
const uid = (prefix: string) => `${prefix}_${++idCounter}_${Date.now().toString(36)}`;
const HISTORY_LIMIT = 80;

export type ToolMode =
  | { type: "select" }
  | { type: "place"; componentType: ComponentType }
  | { type: "wire"; fromComponentId?: string; fromPinIndex?: 0 | 1 }
  | { type: "probe" }
  | { type: "delete" };

interface EditorSnapshot {
  circuit: Circuit;
  selectedId: string | null;
}

export interface CircuitStore {
  circuit: Circuit;
  selectedId: string | null;
  tool: ToolMode;
  past: EditorSnapshot[];
  future: EditorSnapshot[];

  addComponent: (type: ComponentType, value: number, position: Vec3, rotation?: 0 | 1, label?: string) => string;
  updateComponent: (id: string, patch: Partial<Component>) => void;
  removeComponent: (id: string) => void;
  addWire: (fromComponentId: string, fromPinIndex: 0 | 1, toComponentId: string, toPinIndex: 0 | 1) => string;
  removeWire: (id: string) => void;
  clearCircuit: () => void;
  loadCircuit: (circuit: Circuit) => void;
  setCircuitName: (name: string) => void;

  select: (id: string | null) => void;
  setTool: (tool: ToolMode) => void;
  undo: () => void;
  redo: () => void;
}

const EMPTY_CIRCUIT: Circuit = {
  id: uid("circuit"),
  name: "Untitled Circuit",
  components: [],
  wires: [],
};

function cloneCircuit(circuit: Circuit): Circuit {
  return JSON.parse(JSON.stringify(circuit)) as Circuit;
}

function snapshotOf(state: Pick<CircuitStore, "circuit" | "selectedId">): EditorSnapshot {
  return {
    circuit: cloneCircuit(state.circuit),
    selectedId: state.selectedId,
  };
}

function normalizeLabel(label: string) {
  return label.trim().toLowerCase();
}

function nextLabel(type: ComponentType, components: Component[]) {
  if (type === "ground") {
    const groundLabels = components
      .map((component) => component.label)
      .filter((label): label is string => Boolean(label))
      .map(normalizeLabel)
      .filter((label) => label.startsWith("gnd"));
    return groundLabels.length === 0 ? "GND" : `GND${groundLabels.length + 1}`;
  }

  const prefix: Record<ComponentType, string> = {
    resistor: "R",
    capacitor: "C",
    inductor: "L",
    voltage_source: "V",
    current_source: "I",
    switch: "SW",
    bulb: "B",
    ground: "GND",
  };

  const used = new Set(
    components
      .map((component) => component.label)
      .filter((label): label is string => Boolean(label))
      .map(normalizeLabel)
  );

  let index = 1;
  while (used.has(normalizeLabel(`${prefix[type]}${index}`))) {
    index += 1;
  }
  return `${prefix[type]}${index}`;
}

function sanitizeCircuit(circuit: Circuit): Circuit {
  return {
    id: circuit.id || uid("circuit"),
    name: circuit.name || "Imported Circuit",
    components: (circuit.components || []).map((component) => ({
      ...component,
      label: component.label?.trim() || nextLabel(component.type, circuit.components || []),
      position: {
        x: Number(component.position?.x ?? 0),
        y: Number(component.position?.y ?? 0),
        z: Number(component.position?.z ?? 0),
      },
      rotation: component.rotation === 1 ? 1 : 0,
    })),
    wires: (circuit.wires || []).map((wire) => ({
      ...wire,
      fromPinIndex: wire.fromPinIndex === 1 ? 1 : 0,
      toPinIndex: wire.toPinIndex === 1 ? 1 : 0,
    })),
  };
}

function updateWithHistory(
  set: (updater: (state: CircuitStore) => Partial<CircuitStore>) => void,
  updater: (state: CircuitStore) => Partial<CircuitStore>
) {
  set((state) => {
    const before = snapshotOf(state);
    const patch = updater(state);
    if (!("circuit" in patch) && !("selectedId" in patch)) {
      return patch;
    }

    const circuit = patch.circuit ?? state.circuit;
    const selectedId = patch.selectedId ?? state.selectedId;
    const past = [...state.past, before].slice(-HISTORY_LIMIT);

    return {
      ...patch,
      circuit,
      selectedId,
      past,
      future: [],
    };
  });
}

export const useCircuitStore = create<CircuitStore>()(
  persist(
    (set, get) => ({
      circuit: EMPTY_CIRCUIT,
      selectedId: null,
      tool: { type: "select" },
      past: [],
      future: [],

      addComponent(type, value, position, rotation = 0, label) {
        const id = uid(type);
        updateWithHistory(set, (state) => ({
          circuit: {
            ...state.circuit,
            components: [
              ...state.circuit.components,
              {
                id,
                type,
                value,
                position,
                rotation,
                label: label?.trim() || nextLabel(type, state.circuit.components),
              },
            ],
          },
          selectedId: id,
        }));
        return id;
      },

      updateComponent(id, patch) {
        updateWithHistory(set, (state) => ({
          circuit: {
            ...state.circuit,
            components: state.circuit.components.map((component) =>
              component.id === id
                ? {
                    ...component,
                    ...patch,
                    label: patch.label !== undefined
                      ? patch.label.trim() || component.label || nextLabel(component.type, state.circuit.components)
                      : component.label,
                  }
                : component
            ),
          },
        }));
      },

      removeComponent(id) {
        updateWithHistory(set, (state) => ({
          circuit: {
            ...state.circuit,
            components: state.circuit.components.filter((component) => component.id !== id),
            wires: state.circuit.wires.filter(
              (wire) => wire.fromComponentId !== id && wire.toComponentId !== id
            ),
          },
          selectedId: state.selectedId === id ? null : state.selectedId,
        }));
      },

      addWire(fromComponentId, fromPinIndex, toComponentId, toPinIndex) {
        const existing = get().circuit.wires.find(
          (wire) =>
            (wire.fromComponentId === fromComponentId &&
              wire.fromPinIndex === fromPinIndex &&
              wire.toComponentId === toComponentId &&
              wire.toPinIndex === toPinIndex) ||
            (wire.fromComponentId === toComponentId &&
              wire.fromPinIndex === toPinIndex &&
              wire.toComponentId === fromComponentId &&
              wire.toPinIndex === fromPinIndex)
        );
        if (existing) return existing.id;

        const id = uid("wire");
        updateWithHistory(set, (state) => ({
          circuit: {
            ...state.circuit,
            wires: [
              ...state.circuit.wires,
              { id, fromComponentId, fromPinIndex, toComponentId, toPinIndex } satisfies Wire,
            ],
          },
        }));
        return id;
      },

      removeWire(id) {
        updateWithHistory(set, (state) => ({
          circuit: {
            ...state.circuit,
            wires: state.circuit.wires.filter((wire) => wire.id !== id),
          },
        }));
      },

      clearCircuit() {
        updateWithHistory(set, () => ({
          circuit: {
            id: uid("circuit"),
            name: "Untitled Circuit",
            components: [],
            wires: [],
          },
          selectedId: null,
        }));
      },

      loadCircuit(circuit) {
        updateWithHistory(set, () => ({
          circuit: sanitizeCircuit(circuit),
          selectedId: null,
        }));
      },

      setCircuitName(name) {
        updateWithHistory(set, (state) => ({
          circuit: {
            ...state.circuit,
            name: name.trim() || "Untitled Circuit",
          },
        }));
      },

      select(id) {
        set(() => ({ selectedId: id }));
      },

      setTool(tool) {
        set(() => ({ tool }));
      },

      undo() {
        set((state) => {
          const previous = state.past[state.past.length - 1];
          if (!previous) return state;
          return {
            circuit: cloneCircuit(previous.circuit),
            selectedId: previous.selectedId,
            past: state.past.slice(0, -1),
            future: [snapshotOf(state), ...state.future].slice(0, HISTORY_LIMIT),
          };
        });
      },

      redo() {
        set((state) => {
          const next = state.future[0];
          if (!next) return state;
          return {
            circuit: cloneCircuit(next.circuit),
            selectedId: next.selectedId,
            future: state.future.slice(1),
            past: [...state.past, snapshotOf(state)].slice(-HISTORY_LIMIT),
          };
        });
      },
    }),
    {
      name: "circuitsim-circuit",
      partialize: (state) => ({ circuit: state.circuit }),
    }
  )
);
