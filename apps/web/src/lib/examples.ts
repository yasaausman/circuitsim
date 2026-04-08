import type { Circuit } from "@circuitsim/engine";

const exampleCircuits: Record<string, Circuit> = {
  "Voltage Divider": {
    id: "example-divider",
    name: "Voltage Divider",
    components: [
      { id: "v1", type: "voltage_source", value: 12, label: "V1", position: { x: -6, y: 0, z: 0 }, rotation: 1 },
      { id: "r1", type: "resistor", value: 10000, label: "R1", position: { x: -2, y: 0, z: 0 }, rotation: 0 },
      { id: "r2", type: "resistor", value: 2200, label: "R2", position: { x: 2, y: 0, z: 0 }, rotation: 0 },
      { id: "gnd", type: "ground", value: 0, label: "GND", position: { x: 6, y: 0, z: 2 }, rotation: 0 },
    ],
    wires: [
      { id: "w1", fromComponentId: "v1", fromPinIndex: 0, toComponentId: "r1", toPinIndex: 0 },
      { id: "w2", fromComponentId: "r1", fromPinIndex: 1, toComponentId: "r2", toPinIndex: 0 },
      { id: "w3", fromComponentId: "r2", fromPinIndex: 1, toComponentId: "v1", toPinIndex: 1 },
      { id: "w4", fromComponentId: "v1", fromPinIndex: 1, toComponentId: "gnd", toPinIndex: 0 },
    ],
  },
  "RC Filter": {
    id: "example-rc",
    name: "RC Low-Pass Filter",
    components: [
      { id: "v1", type: "voltage_source", value: 5, label: "V1", position: { x: -6, y: 0, z: 0 }, rotation: 1 },
      { id: "r1", type: "resistor", value: 1000, label: "R1", position: { x: -2, y: 0, z: 0 }, rotation: 0 },
      { id: "c1", type: "capacitor", value: 0.000001, label: "C1", position: { x: 2, y: 0, z: 2 }, rotation: 1 },
      { id: "gnd", type: "ground", value: 0, label: "GND", position: { x: 2, y: 0, z: 5 }, rotation: 0 },
    ],
    wires: [
      { id: "w1", fromComponentId: "v1", fromPinIndex: 0, toComponentId: "r1", toPinIndex: 0 },
      { id: "w2", fromComponentId: "r1", fromPinIndex: 1, toComponentId: "c1", toPinIndex: 0 },
      { id: "w3", fromComponentId: "c1", fromPinIndex: 1, toComponentId: "gnd", toPinIndex: 0 },
      { id: "w4", fromComponentId: "v1", fromPinIndex: 1, toComponentId: "gnd", toPinIndex: 0 },
    ],
  },
  "Lamp Circuit": {
    id: "example-lamp",
    name: "Lamp With Series Resistor",
    components: [
      { id: "v1", type: "voltage_source", value: 9, label: "V1", position: { x: -6, y: 0, z: 0 }, rotation: 1 },
      { id: "r1", type: "resistor", value: 330, label: "R1", position: { x: -2, y: 0, z: 0 }, rotation: 0 },
      { id: "b1", type: "bulb", value: 60, label: "B1", position: { x: 2, y: 0, z: 0 }, rotation: 0 },
      { id: "gnd", type: "ground", value: 0, label: "GND", position: { x: 6, y: 0, z: 2 }, rotation: 0 },
    ],
    wires: [
      { id: "w1", fromComponentId: "v1", fromPinIndex: 0, toComponentId: "r1", toPinIndex: 0 },
      { id: "w2", fromComponentId: "r1", fromPinIndex: 1, toComponentId: "b1", toPinIndex: 0 },
      { id: "w3", fromComponentId: "b1", fromPinIndex: 1, toComponentId: "v1", toPinIndex: 1 },
      { id: "w4", fromComponentId: "v1", fromPinIndex: 1, toComponentId: "gnd", toPinIndex: 0 },
    ],
  },
  "RC Step Response": {
    id: "example-switch-rc",
    name: "RC Step Response",
    components: [
      { id: "v1", type: "voltage_source", value: 5, label: "V1", position: { x: -8, y: 0, z: 0 }, rotation: 1 },
      { id: "sw1", type: "switch", value: 0.002, label: "SW1", position: { x: -4, y: 0, z: 0 }, rotation: 0 },
      { id: "r1", type: "resistor", value: 1000, label: "R1", position: { x: 0, y: 0, z: 0 }, rotation: 0 },
      { id: "c1", type: "capacitor", value: 0.000001, label: "C1", position: { x: 4, y: 0, z: 2 }, rotation: 1 },
      { id: "gnd", type: "ground", value: 0, label: "GND", position: { x: 4, y: 0, z: 5 }, rotation: 0 },
    ],
    wires: [
      { id: "w1", fromComponentId: "v1", fromPinIndex: 0, toComponentId: "sw1", toPinIndex: 0 },
      { id: "w2", fromComponentId: "sw1", fromPinIndex: 1, toComponentId: "r1", toPinIndex: 0 },
      { id: "w3", fromComponentId: "r1", fromPinIndex: 1, toComponentId: "c1", toPinIndex: 0 },
      { id: "w4", fromComponentId: "c1", fromPinIndex: 1, toComponentId: "gnd", toPinIndex: 0 },
      { id: "w5", fromComponentId: "v1", fromPinIndex: 1, toComponentId: "gnd", toPinIndex: 0 },
    ],
  },
};

export const EXAMPLE_CIRCUITS = Object.entries(exampleCircuits).map(([name, circuit]) => ({
  name,
  circuit,
}));
