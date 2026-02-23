// ─── Component types ──────────────────────────────────────────────────────────

export type ComponentType =
  | "resistor"
  | "capacitor"
  | "inductor"
  | "voltage_source"
  | "current_source"
  | "ground"
  | "bulb";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * A two-terminal (or one-terminal for ground) circuit component.
 * Pin 0 is the positive/anode terminal; pin 1 is the negative/cathode.
 * Ground has only pin 0.
 */
export interface Component {
  id: string;
  type: ComponentType;
  /** Value in SI units: Ω, F, H, V, A; for bulb: filament resistance in Ω */
  value: number;
  label?: string;
  position: Vec3;
  /** 0 = horizontal (pin0 at -x), 1 = vertical (pin0 at -z) */
  rotation: 0 | 1;
}

export interface Wire {
  id: string;
  fromComponentId: string;
  fromPinIndex: 0 | 1;
  toComponentId: string;
  toPinIndex: 0 | 1;
}

export interface Circuit {
  id: string;
  name: string;
  components: Component[];
  wires: Wire[];
}

// ─── Simulation options ───────────────────────────────────────────────────────

export interface DCOptions {
  type: "dc";
}

export interface TransientOptions {
  type: "transient";
  /** Time step in seconds (default: 1e-4) */
  stepSize: number;
  /** Stop time in seconds (default: 1e-2) */
  stopTime: number;
}

export type SimOptions = DCOptions | TransientOptions;

// ─── Simulation results ───────────────────────────────────────────────────────

export interface DCResult {
  type: "dc";
  /** nodeId → voltage (V) */
  nodeVoltages: Record<string, number>;
  /** componentId → current through component (A), positive = pin0→pin1 */
  branchCurrents: Record<string, number>;
  converged: true;
}

export interface TransientFrame {
  time: number;
  nodeVoltages: Record<string, number>;
  branchCurrents: Record<string, number>;
}

export interface TransientResult {
  type: "transient";
  frames: TransientFrame[];
  converged: true;
}

export interface SimError {
  converged: false;
  message: string;
}

export type SimResult = DCResult | TransientResult | SimError;

// ─── Probe ────────────────────────────────────────────────────────────────────

export interface ProbeResult {
  nodeId: string;
  voltage: number;
  /** Current from the wire's from-component into this node (A) */
  current?: number;
}
