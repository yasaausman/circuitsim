import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import type { ComponentType } from "@circuitsim/engine";
import { CircuitGrid } from "./Grid";
import { ComponentMesh } from "./ComponentMesh";
import { WireMesh } from "./WireMesh";
import { useCircuitStore } from "../../store/circuit";
import { useViewStore } from "../../store/view";

function GroundPlane({
  onPointerMove,
  onPointerDown,
}: {
  onPointerMove: (position: THREE.Vector3) => void;
  onPointerDown: (position: THREE.Vector3) => void;
}) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      onPointerMove={(event) => {
        event.stopPropagation();
        onPointerMove(event.point);
      }}
      onClick={(event) => {
        event.stopPropagation();
        onPointerDown(event.point);
      }}
    >
      <planeGeometry args={[240, 240]} />
      <meshBasicMaterial visible={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function GhostComponent({
  position,
}: {
  position: THREE.Vector3;
}) {
  return (
    <mesh position={[position.x, 0.1, position.z]}>
      <boxGeometry args={[1.8, 0.3, 0.3]} />
      <meshStandardMaterial color="#10b981" transparent opacity={0.35} wireframe />
    </mesh>
  );
}

function FitViewController({
  controlsRef,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const fitViewToken = useViewStore((state) => state.fitViewToken);
  const components = useCircuitStore((state) => state.circuit.components);
  const { camera } = useThree();

  useEffect(() => {
    if (!controlsRef.current || components.length === 0) return;

    const bounds = new THREE.Box3();
    components.forEach((component) => {
      bounds.expandByPoint(new THREE.Vector3(component.position.x, component.position.y, component.position.z));
    });

    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.z, 6);
    camera.position.set(center.x + radius * 0.8, Math.max(8, radius * 1.2), center.z + radius * 0.8);
    controlsRef.current.target.set(center.x, 0, center.z);
    controlsRef.current.update();
  }, [camera, components, controlsRef, fitViewToken]);

  return null;
}

function Scene() {
  const {
    circuit,
    tool,
    selectedId,
    select,
    addComponent,
    addWire,
    removeComponent,
  } = useCircuitStore();
  const [ghostPosition, setGhostPosition] = useState<THREE.Vector3 | null>(null);
  const [wireFrom, setWireFrom] = useState<{ componentId: string; pinIndex: 0 | 1 } | null>(null);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  useEffect(() => {
    if (tool.type !== "wire") setWireFrom(null);
  }, [tool.type]);

  const snap = (value: number) => Math.round(value / 2) * 2;

  const wireOffsets = useMemo(() => {
    const grouped = new Map<string, number>();
    return circuit.wires.reduce<Record<string, number>>((accumulator, wire) => {
      const key = [wire.fromComponentId, wire.toComponentId].sort().join(":");
      const index = grouped.get(key) ?? 0;
      grouped.set(key, index + 1);
      accumulator[wire.id] = (index - 0.5) * 0.8;
      return accumulator;
    }, {});
  }, [circuit.wires]);

  const handleGroundMove = useCallback((point: THREE.Vector3) => {
    if (tool.type === "place") {
      setGhostPosition(new THREE.Vector3(snap(point.x), 0, snap(point.z)));
    }
  }, [tool.type]);

  const handleGroundClick = useCallback((point: THREE.Vector3) => {
    if (tool.type === "place") {
      const defaults: Record<ComponentType, number> = {
        resistor: 1000,
        capacitor: 1e-6,
        inductor: 1e-3,
        voltage_source: 5,
        current_source: 0.01,
        switch: 0.001,
        bulb: 100,
        ground: 0,
      };
      addComponent(tool.componentType, defaults[tool.componentType], {
        x: snap(point.x),
        y: 0,
        z: snap(point.z),
      });
      return;
    }

    if (tool.type === "select") {
      select(null);
    }
  }, [addComponent, select, tool]);

  const handleComponentClick = useCallback((id: string) => {
    if (tool.type === "delete") {
      removeComponent(id);
      return;
    }
    select(id);
  }, [removeComponent, select, tool.type]);

  const handlePinClick = useCallback((componentId: string, pinIndex: 0 | 1) => {
    if (tool.type !== "wire") return;
    if (!wireFrom) {
      setWireFrom({ componentId, pinIndex });
      return;
    }
    if (wireFrom.componentId !== componentId || wireFrom.pinIndex !== pinIndex) {
      addWire(wireFrom.componentId, wireFrom.pinIndex, componentId, pinIndex);
    }
    setWireFrom(null);
  }, [addWire, tool.type, wireFrom]);

  return (
    <>
      <color attach="background" args={["#f8fafc"]} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[12, 18, 10]} intensity={1.2} castShadow />
      <pointLight position={[-10, 14, -10]} intensity={0.35} color="#38bdf8" />
      <Environment preset="city" />

      <CircuitGrid />
      <GroundPlane onPointerMove={handleGroundMove} onPointerDown={handleGroundClick} />

      {circuit.wires.map((wire) => (
        <WireMesh
          key={wire.id}
          wire={wire}
          components={circuit.components}
          laneOffset={wireOffsets[wire.id] ?? 0}
        />
      ))}

      {circuit.components.map((component) => (
        <ComponentMesh
          key={component.id}
          component={component}
          selected={selectedId === component.id}
          showPins={tool.type === "wire"}
          onClick={() => handleComponentClick(component.id)}
          onPinClick={(pinIndex) => handlePinClick(component.id, pinIndex)}
        />
      ))}

      {tool.type === "place" && ghostPosition && <GhostComponent position={ghostPosition} />}

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan
        enableZoom
        enableRotate
        screenSpacePanning
        minDistance={4}
        maxDistance={90}
        minPolarAngle={0.1}
        maxPolarAngle={Math.PI - 0.18}
      />
      <FitViewController controlsRef={controlsRef} />
    </>
  );
}

function MiniMap() {
  const components = useCircuitStore((state) => state.circuit.components);
  const selectedId = useCircuitStore((state) => state.selectedId);

  const viewBox = useMemo(() => {
    if (components.length === 0) return "0 0 120 80";
    const xs = components.map((component) => component.position.x);
    const zs = components.map((component) => component.position.z);
    const minX = Math.min(...xs) - 2;
    const maxX = Math.max(...xs) + 2;
    const minZ = Math.min(...zs) - 2;
    const maxZ = Math.max(...zs) + 2;
    return `${minX} ${minZ} ${Math.max(maxX - minX, 8)} ${Math.max(maxZ - minZ, 8)}`;
  }, [components]);

  return (
    <div className="absolute right-3 top-3 w-40 rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-lg backdrop-blur">
      <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-slate-500">Minimap</p>
      <svg viewBox={viewBox} className="h-28 w-full rounded-xl bg-slate-50">
        {components.map((component) => (
          <circle
            key={component.id}
            cx={component.position.x}
            cy={component.position.z}
            r={selectedId === component.id ? 0.9 : 0.6}
            fill={selectedId === component.id ? "#10b981" : "#0f172a"}
          />
        ))}
      </svg>
      <p className="mt-2 text-xs text-slate-500">Use Zoom to Fit in the toolbar any time the circuit drifts off-screen.</p>
    </div>
  );
}

export function CircuitCanvas() {
  return (
    <div className="relative h-full w-full">
      <Canvas camera={{ position: [12, 16, 12], fov: 45, near: 0.1, far: 500 }} shadows gl={{ antialias: true, alpha: false }}>
        <Scene />
      </Canvas>
      <MiniMap />
    </div>
  );
}
