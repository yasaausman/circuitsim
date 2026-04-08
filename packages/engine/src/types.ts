export type ComponentType =
  | "resistor"
  | "capacitor"
  | "inductor"
  | "voltage_source"
  | "current_source"
  | "switch"
  | "ground"
  | "bulb";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Component {
  id: string;
  type: ComponentType;
  value: number;
  label?: string;
  position: Vec3;
  /** 0 = horizontal, 1 = vertical */
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

export interface DCOptions {
  type: "dc";
}

export interface ACOptions {
  type: "ac";
  frequency: number;
}

export interface TransientOptions {
  type: "transient";
  stepSize: number;
  stopTime: number;
}

export type SimOptions = DCOptions | ACOptions | TransientOptions;

export type WarningSeverity = "info" | "warning" | "error";

export interface AnalysisWarning {
  id: string;
  kind:
    | "missing_ground"
    | "open_circuit"
    | "short_circuit"
    | "floating_component"
    | "solver"
    | "analysis";
  severity: WarningSeverity;
  title: string;
  message: string;
  componentId?: string;
  nodeId?: string;
}

export interface BaseSimResult {
  warnings: AnalysisWarning[];
  componentPowers: Record<string, number>;
}

export interface DCResult extends BaseSimResult {
  type: "dc";
  nodeVoltages: Record<string, number>;
  branchCurrents: Record<string, number>;
  converged: true;
}

export interface ACResult extends BaseSimResult {
  type: "ac";
  frequency: number;
  /** Magnitude values for the steady-state sinusoidal solution */
  nodeVoltages: Record<string, number>;
  branchCurrents: Record<string, number>;
  converged: true;
}

export interface TransientFrame {
  time: number;
  nodeVoltages: Record<string, number>;
  branchCurrents: Record<string, number>;
  componentPowers: Record<string, number>;
}

export interface TransientResult extends BaseSimResult {
  type: "transient";
  frames: TransientFrame[];
  converged: true;
}

export interface SimError {
  converged: false;
  message: string;
  warnings?: AnalysisWarning[];
}

export type SimResult = DCResult | ACResult | TransientResult | SimError;

export interface ProbeResult {
  nodeId: string;
  voltage: number;
  current?: number;
}
