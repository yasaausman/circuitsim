import { useMemo } from "react";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import type { Component, Wire } from "@circuitsim/engine";
import { useSimStore } from "../../store/simulation";

function getPinWorldPosition(component: Component, pinIndex: 0 | 1) {
  const localOffset = pinIndex === 0 ? -0.9 : 0.9;

  if (component.type === "ground") {
    return new THREE.Vector3(component.position.x, component.position.y + 0.9, component.position.z);
  }

  if (component.rotation === 1) {
    return new THREE.Vector3(component.position.x, component.position.y, component.position.z + localOffset);
  }

  return new THREE.Vector3(component.position.x + localOffset, component.position.y, component.position.z);
}

function routePoints(a: THREE.Vector3, b: THREE.Vector3, laneOffset: number) {
  const horizontalFirst = Math.abs(a.x - b.x) > Math.abs(a.z - b.z);
  const bendA = horizontalFirst
    ? [a.x + laneOffset, 0.08, a.z]
    : [a.x, 0.08, a.z + laneOffset];
  const bendB = horizontalFirst
    ? [a.x + laneOffset, 0.08, b.z]
    : [b.x, 0.08, a.z + laneOffset];

  return [
    [a.x, 0.08, a.z],
    bendA,
    bendB,
    [b.x, 0.08, b.z],
  ] as [number, number, number][];
}

interface Props {
  wire: Wire;
  components: Component[];
  laneOffset?: number;
}

export function WireMesh({ wire, components, laneOffset = 0 }: Props) {
  const getBranchCurrent = useSimStore((state) => state.getBranchCurrent);
  const from = components.find((component) => component.id === wire.fromComponentId);
  const to = components.find((component) => component.id === wire.toComponentId);

  const points = useMemo(() => {
    if (!from || !to) return null;
    return routePoints(
      getPinWorldPosition(from, wire.fromPinIndex),
      getPinWorldPosition(to, wire.toPinIndex),
      laneOffset
    );
  }, [from, laneOffset, to, wire.fromPinIndex, wire.toPinIndex]);

  if (!points) return null;

  const current = getBranchCurrent(wire.fromComponentId);
  const magnitude = Math.abs(current ?? 0);
  const color = current === null
    ? "#14b8a6"
    : magnitude > 0.1
      ? "#f97316"
      : magnitude > 0.01
        ? "#0284c7"
        : "#0f766e";

  return <Line points={points} color={color} lineWidth={magnitude > 0.01 ? 3 : 2} />;
}
