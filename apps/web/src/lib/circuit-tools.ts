import { buildNetlist, exportSpiceNetlist } from "@circuitsim/engine";
import type { Circuit } from "@circuitsim/engine";

function snapshot(circuit: Circuit) {
  return JSON.stringify(circuit);
}

export function encodeCircuitToUrl(circuit: Circuit) {
  return btoa(unescape(encodeURIComponent(snapshot(circuit))));
}

export function decodeCircuitFromUrl(value: string) {
  try {
    const json = decodeURIComponent(escape(atob(value)));
    return JSON.parse(json) as Circuit;
  } catch {
    return null;
  }
}

export function downloadText(filename: string, content: string, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function exportCircuitSvg(circuit: Circuit) {
  const components = circuit.components;
  if (components.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="#f8fafc"/><text x="50%" y="50%" text-anchor="middle" fill="#475569" font-family="Arial" font-size="18">Empty circuit</text></svg>`;
  }

  const xs = components.map((component) => component.position.x);
  const zs = components.map((component) => component.position.z);
  const minX = Math.min(...xs) - 3;
  const maxX = Math.max(...xs) + 3;
  const minZ = Math.min(...zs) - 3;
  const maxZ = Math.max(...zs) + 3;
  const width = Math.max(320, (maxX - minX) * 40);
  const height = Math.max(220, (maxZ - minZ) * 40);

  const scaleX = (x: number) => (x - minX) * 40;
  const scaleY = (z: number) => (z - minZ) * 40;

  const byId = new Map(components.map((component) => [component.id, component]));
  const wirePaths = circuit.wires.map((wire) => {
    const from = byId.get(wire.fromComponentId);
    const to = byId.get(wire.toComponentId);
    if (!from || !to) return "";
    const x1 = scaleX(from.position.x);
    const y1 = scaleY(from.position.z);
    const x2 = scaleX(to.position.x);
    const y2 = scaleY(to.position.z);
    const mx = (x1 + x2) / 2;
    return `<path d="M ${x1} ${y1} L ${mx} ${y1} L ${mx} ${y2} L ${x2} ${y2}" fill="none" stroke="#0f766e" stroke-width="3" stroke-linejoin="round"/>`;
  }).join("");

  const componentNodes = components.map((component) => {
    const x = scaleX(component.position.x);
    const y = scaleY(component.position.z);
    const label = component.label || component.id;
    return `
      <g transform="translate(${x}, ${y})">
        <rect x="-24" y="-14" width="48" height="28" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
        <text x="0" y="-2" text-anchor="middle" fill="#0f172a" font-size="11" font-family="Arial">${label}</text>
        <text x="0" y="12" text-anchor="middle" fill="#475569" font-size="9" font-family="Arial">${component.type}</text>
      </g>
    `;
  }).join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="#f8fafc"/>
      ${wirePaths}
      ${componentNodes}
    </svg>
  `;
}

export function exportCircuitImage() {
  const canvas = document.querySelector("canvas");
  if (!(canvas instanceof HTMLCanvasElement)) return false;
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = "circuitsim.png";
  link.click();
  return true;
}

export function exportNetlist(circuit: Circuit) {
  return exportSpiceNetlist(circuit);
}

export function getNodeLabels(circuit: Circuit) {
  const netlist = buildNetlist(circuit.components, circuit.wires);
  return [netlist.groundNodeId, ...netlist.nodes];
}
