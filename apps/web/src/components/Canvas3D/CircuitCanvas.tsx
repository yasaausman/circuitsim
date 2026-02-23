/**
 * Main 3D canvas — orchestrates the Three.js scene.
 */

import { useCallback, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import * as THREE from "three";
import { CircuitGrid } from "./Grid";
import { ComponentMesh } from "./ComponentMesh";
import { WireMesh } from "./WireMesh";
import { useCircuitStore } from "../../store/circuit";
import type { ComponentType } from "@circuitsim/engine";

// ─── Ground plane for raycasting ──────────────────────────────────────────────

function GroundPlane({ onPointerMove, onPointerDown }: {
  onPointerMove: (pos: THREE.Vector3) => void;
  onPointerDown: (pos: THREE.Vector3) => void;
}) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      onPointerMove={(e) => { e.stopPropagation(); onPointerMove(e.point); }}
      onClick={(e) => { e.stopPropagation(); onPointerDown(e.point); }}
    >
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial visible={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ─── Ghost (placement preview) ────────────────────────────────────────────────

function GhostComponent({ position, componentType }: {
  position: THREE.Vector3;
  componentType: ComponentType;
}) {
  return (
    <mesh position={[position.x, 0.1, position.z]}>
      <boxGeometry args={[1.8, 0.3, 0.3]} />
      <meshStandardMaterial color="#00ff9d" transparent opacity={0.35} wireframe />
    </mesh>
  );
}

// ─── Scene inner ──────────────────────────────────────────────────────────────

function Scene() {
  const { circuit, tool, selectedId, select, setTool, addComponent, addWire } = useCircuitStore();
  const [ghostPos, setGhostPos] = useState<THREE.Vector3 | null>(null);
  const [wireFrom, setWireFrom] = useState<{ componentId: string; pinIndex: 0 | 1 } | null>(null);

  // Clear pending wire start whenever the user leaves wire mode
  useEffect(() => {
    if (tool.type !== "wire") setWireFrom(null);
  }, [tool.type]);

  const snap = (v: number) => Math.round(v / 2) * 2; // snap to 2-unit grid

  const handleGroundMove = useCallback((pos: THREE.Vector3) => {
    if (tool.type === "place") {
      setGhostPos(new THREE.Vector3(snap(pos.x), 0, snap(pos.z)));
    }
  }, [tool]);

  const handleGroundClick = useCallback((pos: THREE.Vector3) => {
    if (tool.type === "place") {
      const DEFAULTS: Record<ComponentType, number> = {
        resistor: 1000,
        capacitor: 1e-6,
        inductor: 1e-3,
        voltage_source: 5,
        current_source: 0.01,
        ground: 0,
      };
      addComponent(
        tool.componentType,
        DEFAULTS[tool.componentType],
        { x: snap(pos.x), y: 0, z: snap(pos.z) }
      );
    } else if (tool.type === "select") {
      select(null);
    }
  }, [tool, addComponent, select]);

  const handleComponentClick = useCallback((id: string) => {
    if (tool.type === "select" || tool.type === "probe") {
      select(id);
    } else if (tool.type === "delete") {
      useCircuitStore.getState().removeComponent(id);
    }
  }, [tool, select]);

  const handlePinClick = useCallback((componentId: string, pinIndex: 0 | 1) => {
    if (tool.type !== "wire") return;
    if (!wireFrom) {
      setWireFrom({ componentId, pinIndex });
    } else {
      if (wireFrom.componentId !== componentId) {
        addWire(wireFrom.componentId, wireFrom.pinIndex ?? 0, componentId, pinIndex);
      }
      setWireFrom(null);
    }
  }, [tool, wireFrom, addWire]);

  const showPins = tool.type === "wire";

  return (
    <>
      <color attach="background" args={["#ffffff"]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} castShadow />
      <pointLight position={[-10, 10, -10]} intensity={0.3} color="#00ff9d" />

      <CircuitGrid />
      <GroundPlane onPointerMove={handleGroundMove} onPointerDown={handleGroundClick} />

      {/* Wires */}
      {circuit.wires.map((wire) => (
        <WireMesh key={wire.id} wire={wire} components={circuit.components} />
      ))}

      {/* Components */}
      {circuit.components.map((comp) => (
        <ComponentMesh
          key={comp.id}
          component={comp}
          selected={selectedId === comp.id}
          showPins={showPins}
          onClick={() => handleComponentClick(comp.id)}
          onPinClick={(pin) => handlePinClick(comp.id, pin)}
        />
      ))}

      {/* Placement ghost */}
      {tool.type === "place" && ghostPos && (
        <GhostComponent position={ghostPos} componentType={tool.componentType} />
      )}

      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        enableRotate
        minDistance={3}
        maxDistance={80}
        maxPolarAngle={Math.PI / 2.2}
      />
    </>
  );
}

// ─── Exported canvas ──────────────────────────────────────────────────────────

export function CircuitCanvas() {
  return (
    <Canvas
      camera={{ position: [0, 14, 14], fov: 45, near: 0.1, far: 500 }}
      shadows
      gl={{ antialias: true, alpha: false }}
      style={{ background: "#ffffff" }}
    >
      <Scene />
    </Canvas>
  );
}
