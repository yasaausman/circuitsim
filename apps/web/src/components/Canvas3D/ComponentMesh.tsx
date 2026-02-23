/**
 * 3D meshes for each circuit component type.
 * Pin 0 is always at the "start" end, pin 1 at the "end" end.
 * Horizontal: pin0 at -X, pin1 at +X
 * Vertical:   pin0 at -Z, pin1 at +Z
 */

import { useMemo } from "react";
import { Html, Line } from "@react-three/drei";
import * as THREE from "three";
import type { Component } from "@circuitsim/engine";
import { useSimStore } from "../../store/simulation";

// ─── Voltage → color mapping ──────────────────────────────────────────────────

function voltageColor(v: number | null): string {
  if (v === null) return "#888";
  const clamped = Math.max(-12, Math.min(12, v));
  const t = (clamped + 12) / 24; // 0..1
  const r = Math.round(t * 255);
  const b = Math.round((1 - t) * 255);
  return `rgb(${r},64,${b})`;
}

// ─── Lead wire helper ─────────────────────────────────────────────────────────

function Lead({ from, to }: { from: [number,number,number]; to: [number,number,number] }) {
  return (
    <Line points={[from, to]} color="#b87333" lineWidth={2} />
  );
}

// ─── Component meshes ─────────────────────────────────────────────────────────

function ResistorBody({ value }: { value: number }) {
  return (
    <group>
      <mesh>
        <boxGeometry args={[1.2, 0.28, 0.28]} />
        <meshStandardMaterial color="#d4a84b" roughness={0.6} />
      </mesh>
      {/* Bands */}
      {[-0.3, 0, 0.3].map((x, i) => (
        <mesh key={i} position={[x, 0, 0]}>
          <boxGeometry args={[0.1, 0.32, 0.32]} />
          <meshStandardMaterial color={["#1a1a1a","#c00","#f80"][i]} />
        </mesh>
      ))}
      <Lead from={[-0.9, 0, 0]} to={[-0.6, 0, 0]} />
      <Lead from={[0.6, 0, 0]} to={[0.9, 0, 0]} />
    </group>
  );
}

function CapacitorBody({ value }: { value: number }) {
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[0.22, 0.22, 0.8, 16]} />
        <meshStandardMaterial color="#2255aa" roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Polarity stripe */}
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.225, 0.225, 0.1, 16]} />
        <meshStandardMaterial color="#888" />
      </mesh>
      <Lead from={[-0.9, 0, 0]} to={[-0.01, 0, 0]} />
      <Lead from={[0.01, 0, 0]} to={[0.9, 0, 0]} />
    </group>
  );
}

function InductorBody() {
  const coils = 5;
  const coilPoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= coils * 32; i++) {
      const t = i / (coils * 32);
      const angle = t * coils * Math.PI * 2;
      pts.push(new THREE.Vector3(
        (t - 0.5) * 1.4,
        Math.sin(angle) * 0.15,
        Math.cos(angle) * 0.15
      ));
    }
    return pts;
  }, []);

  return (
    <group>
      <Line points={coilPoints} color="#c0a000" lineWidth={3} />
      <Lead from={[-0.9, 0, 0]} to={[-0.7, 0, 0]} />
      <Lead from={[0.7, 0, 0]} to={[0.9, 0, 0]} />
    </group>
  );
}

function VoltageSourceBody({ value }: { value: number }) {
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[0.35, 0.35, 0.8, 24]} />
        <meshStandardMaterial color="#1a3a1a" roughness={0.5} />
      </mesh>
      {/* Outer ring */}
      <mesh>
        <torusGeometry args={[0.35, 0.03, 8, 24]} />
        <meshStandardMaterial color="#00ff9d" emissive="#00ff9d" emissiveIntensity={0.6} />
      </mesh>
      {/* + and - labels */}
      <Html position={[0, 0.55, 0]} center style={{ fontSize: 10, color: "#00ff9d", pointerEvents: "none" }}>
        <span>+</span>
      </Html>
      <Html position={[0, -0.55, 0]} center style={{ fontSize: 10, color: "#ff4757", pointerEvents: "none" }}>
        <span>−</span>
      </Html>
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
        <meshStandardMaterial color="#4f8ef7" emissive="#4f8ef7" emissiveIntensity={0.3} />
      </mesh>
      {/* Arrow */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.12, 0.3, 8]} />
        <meshStandardMaterial color="#4f8ef7" emissive="#4f8ef7" emissiveIntensity={0.4} />
      </mesh>
      <Lead from={[-0.9, 0, 0]} to={[-0.35, 0, 0]} />
      <Lead from={[0.35, 0, 0]} to={[0.9, 0, 0]} />
    </group>
  );
}

function GroundBody() {
  return (
    <group>
      {[0, 1, 2].map((i) => {
        const w = 0.6 - i * 0.16;
        return (
          <mesh key={i} position={[0, -i * 0.18, 0]}>
            <boxGeometry args={[w, 0.05, 0.05]} />
            <meshStandardMaterial color="#00ff9d" emissive="#00ff9d" emissiveIntensity={0.5} />
          </mesh>
        );
      })}
      <Lead from={[0, 0.9, 0]} to={[0, 0.1, 0]} />
    </group>
  );
}

// ─── Selection ring ───────────────────────────────────────────────────────────

function SelectionRing() {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.7, 0.025, 8, 32]} />
      <meshStandardMaterial color="#00ff9d" emissive="#00ff9d" emissiveIntensity={1} transparent opacity={0.8} />
    </mesh>
  );
}

// ─── Pin indicator ────────────────────────────────────────────────────────────

export function PinIndicator({ position, active }: { position: [number,number,number]; active: boolean }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.1, 8, 8]} />
      <meshStandardMaterial
        color={active ? "#00ff9d" : "#555"}
        emissive={active ? "#00ff9d" : "#000"}
        emissiveIntensity={active ? 0.8 : 0}
      />
    </mesh>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  component: Component;
  selected: boolean;
  onClick: () => void;
  onPinClick: (pinIndex: 0 | 1) => void;
  showPins: boolean;
}

export function ComponentMesh({ component, selected, onClick, onPinClick, showPins }: Props) {
  const { position, rotation, type, value, label } = component;
  const getNodeVoltage = useSimStore((s) => s.getNodeVoltage);

  const rotY = rotation === 1 ? Math.PI / 2 : 0;

  // Pin world positions (in local space, then rotated)
  const pin0Local: [number,number,number] = [-0.9, 0, 0];
  const pin1Local: [number,number,number] = [0.9, 0, 0];

  return (
    <group
      position={[position.x, position.y, position.z]}
      rotation={[0, rotY, 0]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      {/* Body */}
      {type === "resistor" && <ResistorBody value={value} />}
      {type === "capacitor" && <CapacitorBody value={value} />}
      {type === "inductor" && <InductorBody />}
      {type === "voltage_source" && <VoltageSourceBody value={value} />}
      {type === "current_source" && <CurrentSourceBody />}
      {type === "ground" && <GroundBody />}

      {/* Selection ring */}
      {selected && <SelectionRing />}

      {/* Pin indicators */}
      {showPins && type !== "ground" && (
        <>
          <PinIndicator position={pin0Local} active={showPins} />
          <PinIndicator position={pin1Local} active={showPins} />
          <mesh
            position={pin0Local}
            onClick={(e) => { e.stopPropagation(); onPinClick(0); }}
          >
            <sphereGeometry args={[0.18, 8, 8]} />
            <meshStandardMaterial transparent opacity={0} />
          </mesh>
          <mesh
            position={pin1Local}
            onClick={(e) => { e.stopPropagation(); onPinClick(1); }}
          >
            <sphereGeometry args={[0.18, 8, 8]} />
            <meshStandardMaterial transparent opacity={0} />
          </mesh>
        </>
      )}

      {/* Label */}
      {label && (
        <Html position={[0, 0.7, 0]} center style={{ fontSize: 9, color: "#aaa", pointerEvents: "none", whiteSpace: "nowrap" }}>
          {label}
        </Html>
      )}
    </group>
  );
}
