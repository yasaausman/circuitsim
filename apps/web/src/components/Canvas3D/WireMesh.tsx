/**
 * Renders a wire as a smooth path between two component pins.
 */

import { useMemo } from "react";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import type { Wire, Component } from "@circuitsim/engine";
import { useSimStore } from "../../store/simulation";

function getPinWorldPosition(comp: Component, pinIndex: 0 | 1): THREE.Vector3 {
  const { position, rotation } = comp;
  const localOffset = pinIndex === 0 ? -0.9 : 0.9;

  if (comp.type === "ground") {
    return new THREE.Vector3(position.x, position.y + 0.9, position.z);
  }
  if (rotation === 1) {
    return new THREE.Vector3(position.x, position.y, position.z + localOffset);
  }
  return new THREE.Vector3(position.x + localOffset, position.y, position.z);
}

function routePoints(a: THREE.Vector3, b: THREE.Vector3): [number, number, number][] {
  // L-shaped Manhattan route
  const mid: [number,number,number] = [(a.x + b.x) / 2, 0.08, a.z];
  return [
    [a.x, 0.08, a.z],
    mid,
    [b.x, 0.08, b.z],
  ];
}

interface Props {
  wire: Wire;
  components: Component[];
  onClick?: () => void;
}

export function WireMesh({ wire, components, onClick }: Props) {
  const getBranchCurrent = useSimStore((s) => s.getBranchCurrent);

  const fromComp = components.find((c) => c.id === wire.fromComponentId);
  const toComp = components.find((c) => c.id === wire.toComponentId);

  const points = useMemo(() => {
    if (!fromComp || !toComp) return null;
    const a = getPinWorldPosition(fromComp, wire.fromPinIndex);
    const b = getPinWorldPosition(toComp, wire.toPinIndex);
    return routePoints(a, b);
  }, [fromComp, toComp, wire]);

  if (!points) return null;

  const current = getBranchCurrent(wire.fromComponentId);
  const hasResult = current !== null;
  const mag = Math.abs(current ?? 0);
  const color = !hasResult
    ? "#2a4a2a"
    : mag > 0.1
    ? "#f7b731"
    : mag > 0.01
    ? "#ff8c00"
    : "#00bcd4";

  return (
    <group onClick={(e) => { e.stopPropagation(); onClick?.(); }}>
      <Line
        points={points}
        color={color}
        lineWidth={hasResult && mag > 0.01 ? 3 : 2}
      />
    </group>
  );
}
