import { useRef } from "react";
import { Grid as DreiGrid } from "@react-three/drei";

export function CircuitGrid() {
  return (
    <>
      {/* Main grid */}
      <DreiGrid
        position={[0, -0.01, 0]}
        args={[40, 40]}
        cellSize={1}
        cellThickness={0.4}
        cellColor="#1a2a1a"
        sectionSize={5}
        sectionThickness={0.8}
        sectionColor="#0d3d1a"
        fadeDistance={60}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={true}
      />
      {/* Subtle ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#070d07" transparent opacity={0.8} />
      </mesh>
    </>
  );
}
