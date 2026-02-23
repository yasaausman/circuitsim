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
        cellColor="#000000"
        sectionSize={5}
        sectionThickness={0.8}
        sectionColor="#000000"
        fadeDistance={60}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={true}
      />
      {/* Subtle ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={1} />
      </mesh>
    </>
  );
}
