import { Grid as DreiGrid } from "@react-three/drei";

export function CircuitGrid() {
  return (
    <>
      <DreiGrid
        position={[0, -0.01, 0]}
        args={[60, 60]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#cbd5e1"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#94a3b8"
        fadeDistance={90}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[240, 240]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
    </>
  );
}
