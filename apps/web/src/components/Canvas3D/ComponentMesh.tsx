import { Html, Line } from "@react-three/drei";
import type { Component } from "@circuitsim/engine";
import { useSimStore } from "../../store/simulation";

function formatPowerLabel(value: number | null) {
  if (value === null) return null;
  const magnitude = Math.abs(value);
  if (magnitude >= 1) return `${value.toFixed(3)}W`;
  if (magnitude >= 1e-3) return `${(value * 1e3).toFixed(2)}mW`;
  if (magnitude >= 1e-6) return `${(value * 1e6).toFixed(2)}uW`;
  return `${(value * 1e9).toFixed(2)}nW`;
}

function Lead({ from, to }: { from: [number, number, number]; to: [number, number, number] }) {
  return <Line points={[from, to]} color="#64748b" lineWidth={2} />;
}

function ResistorBody() {
  return (
    <group>
      <mesh>
        <boxGeometry args={[1.2, 0.28, 0.28]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.65} />
      </mesh>
      <Lead from={[-0.9, 0, 0]} to={[-0.6, 0, 0]} />
      <Lead from={[0.6, 0, 0]} to={[0.9, 0, 0]} />
    </group>
  );
}

function CapacitorBody() {
  return (
    <group>
      <mesh position={[-0.12, 0, 0]}>
        <boxGeometry args={[0.04, 0.6, 0.4]} />
        <meshStandardMaterial color="#1d4ed8" />
      </mesh>
      <mesh position={[0.12, 0, 0]}>
        <boxGeometry args={[0.04, 0.6, 0.4]} />
        <meshStandardMaterial color="#1d4ed8" />
      </mesh>
      <Lead from={[-0.9, 0, 0]} to={[-0.12, 0, 0]} />
      <Lead from={[0.12, 0, 0]} to={[0.9, 0, 0]} />
    </group>
  );
}

function InductorBody() {
  return (
    <group>
      {[-0.36, -0.12, 0.12, 0.36].map((x) => (
        <mesh key={x} position={[x, 0, 0]}>
          <torusGeometry args={[0.14, 0.04, 8, 16]} />
          <meshStandardMaterial color="#7c3aed" />
        </mesh>
      ))}
      <Lead from={[-0.9, 0, 0]} to={[-0.52, 0, 0]} />
      <Lead from={[0.52, 0, 0]} to={[0.9, 0, 0]} />
    </group>
  );
}

function VoltageSourceBody() {
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[0.35, 0.35, 0.3, 24]} />
        <meshStandardMaterial color="#16a34a" roughness={0.35} />
      </mesh>
      <Lead from={[-0.9, 0, 0]} to={[-0.35, 0, 0]} />
      <Lead from={[0.35, 0, 0]} to={[0.9, 0, 0]} />
    </group>
  );
}

function CurrentSourceBody() {
  return (
    <group>
      <mesh>
        <torusGeometry args={[0.35, 0.04, 8, 24]} />
        <meshStandardMaterial color="#0284c7" />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.12, 0.25, 10]} />
        <meshStandardMaterial color="#0284c7" />
      </mesh>
      <Lead from={[-0.9, 0, 0]} to={[-0.35, 0, 0]} />
      <Lead from={[0.35, 0, 0]} to={[0.9, 0, 0]} />
    </group>
  );
}

function SwitchBody({ closeTime }: { closeTime: number }) {
  const open = closeTime > 0;
  return (
    <group>
      <Lead from={[-0.9, 0, 0]} to={[-0.22, 0, 0]} />
      <Lead from={[0.22, 0, 0]} to={[0.9, 0, 0]} />
      <mesh rotation={[0, 0, open ? -0.45 : 0]}>
        <boxGeometry args={[0.58, 0.06, 0.06]} />
        <meshStandardMaterial color={open ? "#dc2626" : "#16a34a"} />
      </mesh>
      <mesh position={[-0.22, 0, 0]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[0.22, 0, 0]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
    </group>
  );
}

function BulbBody({ componentId }: { componentId: string }) {
  const current = useSimStore((state) => state.getBranchCurrent(componentId));
  const glow = Math.min(1, Math.abs(current ?? 0) * 12);
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.38, 24, 24]} />
        <meshStandardMaterial color="#fef3c7" emissive="#f59e0b" emissiveIntensity={glow} transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, -0.42, 0]}>
        <cylinderGeometry args={[0.2, 0.26, 0.18, 18]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      <Lead from={[-0.9, 0, 0]} to={[-0.35, 0, 0]} />
      <Lead from={[0.35, 0, 0]} to={[0.9, 0, 0]} />
    </group>
  );
}

function GroundBody() {
  return (
    <group>
      {[0.6, 0.42, 0.24].map((width, index) => (
        <mesh key={width} position={[0, -index * 0.18, 0]}>
          <boxGeometry args={[width, 0.05, 0.05]} />
          <meshStandardMaterial color="#0f766e" />
        </mesh>
      ))}
      <Lead from={[0, 0.9, 0]} to={[0, 0.1, 0]} />
    </group>
  );
}

function SelectionRing() {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.78, 0.03, 8, 36]} />
      <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.5} />
    </mesh>
  );
}

function PinIndicator({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.1, 12, 12]} />
      <meshStandardMaterial color="#0ea5e9" emissive="#38bdf8" emissiveIntensity={0.35} />
    </mesh>
  );
}

interface Props {
  component: Component;
  selected: boolean;
  onClick: () => void;
  onPinClick: (pinIndex: 0 | 1) => void;
  showPins: boolean;
}

export function ComponentMesh({ component, selected, onClick, onPinClick, showPins }: Props) {
  const { position, rotation, type, label } = component;
  const componentPower = useSimStore((state) => state.getComponentPower(component.id));
  const rotY = rotation === 1 ? Math.PI / 2 : 0;
  const pin0Local: [number, number, number] = [-0.9, 0, 0];
  const pin1Local: [number, number, number] = [0.9, 0, 0];

  return (
    <group
      position={[position.x, position.y, position.z]}
      rotation={[0, rotY, 0]}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {type === "resistor" && <ResistorBody />}
      {type === "capacitor" && <CapacitorBody />}
      {type === "inductor" && <InductorBody />}
      {type === "voltage_source" && <VoltageSourceBody />}
      {type === "current_source" && <CurrentSourceBody />}
      {type === "switch" && <SwitchBody closeTime={component.value} />}
      {type === "bulb" && <BulbBody componentId={component.id} />}
      {type === "ground" && <GroundBody />}

      {selected && <SelectionRing />}

      {showPins && type !== "ground" && (
        <>
          <PinIndicator position={pin0Local} />
          <PinIndicator position={pin1Local} />
          <mesh position={pin0Local} onClick={(event) => { event.stopPropagation(); onPinClick(0); }}>
            <sphereGeometry args={[0.2, 12, 12]} />
            <meshStandardMaterial transparent opacity={0} />
          </mesh>
          <mesh position={pin1Local} onClick={(event) => { event.stopPropagation(); onPinClick(1); }}>
            <sphereGeometry args={[0.2, 12, 12]} />
            <meshStandardMaterial transparent opacity={0} />
          </mesh>
        </>
      )}

      {showPins && type === "ground" && (
        <>
          <PinIndicator position={[0, 0.9, 0]} />
          <mesh position={[0, 0.9, 0]} onClick={(event) => { event.stopPropagation(); onPinClick(0); }}>
            <sphereGeometry args={[0.2, 12, 12]} />
            <meshStandardMaterial transparent opacity={0} />
          </mesh>
        </>
      )}

      {label && (
        <Html position={[0, 0.9, 0]} center style={{ pointerEvents: "none", whiteSpace: "nowrap" }}>
          <div className="rounded-full border border-slate-200 bg-white/90 px-2 py-1 text-[10px] font-medium text-slate-700 shadow-sm">
            {label}
            {componentPower !== null ? ` · ${formatPowerLabel(componentPower)}` : ""}
          </div>
        </Html>
      )}
    </group>
  );
}
