/**
 * Circuit graph utilities.
 *
 * Converts the visual component/wire list into a netlist:
 *   - Assigns a canonical node ID to every connected set of terminals
 *   - Identifies the ground node
 *   - Returns helpers used by the MNA solver
 */

import type { Component, Wire } from "./types.js";

// ─── Union-Find ───────────────────────────────────────────────────────────────

class UnionFind {
  private parent = new Map<string, string>();

  private root(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    const p = this.parent.get(x)!;
    if (p !== x) {
      const r = this.root(p);
      this.parent.set(x, r); // path compression
      return r;
    }
    return x;
  }

  union(a: string, b: string): void {
    this.parent.set(this.root(a), this.root(b));
  }

  find(x: string): string {
    return this.root(x);
  }
}

// ─── Exported helpers ─────────────────────────────────────────────────────────

export const terminalId = (componentId: string, pinIndex: 0 | 1 | number) =>
  `${componentId}:${pinIndex}`;

export interface Netlist {
  /** terminal id → canonical node id */
  terminalToNode: Map<string, string>;
  /** ordered list of non-ground node ids */
  nodes: string[];
  groundNodeId: string;
}

export function buildNetlist(
  components: Component[],
  wires: Wire[]
): Netlist {
  const uf = new UnionFind();

  // Seed every terminal
  for (const c of components) {
    const pinCount = c.type === "ground" ? 1 : 2;
    for (let i = 0; i < pinCount; i++) uf.find(terminalId(c.id, i));
  }

  // Connect terminals that share a wire
  for (const w of wires) {
    uf.union(
      terminalId(w.fromComponentId, w.fromPinIndex),
      terminalId(w.toComponentId, w.toPinIndex)
    );
  }

  // The ground node is the canonical root of any ground component's pin 0
  const groundComponents = components.filter((c) => c.type === "ground");
  // All ground terminals are unioned together (they share the same potential)
  for (let i = 1; i < groundComponents.length; i++) {
    uf.union(
      terminalId(groundComponents[0].id, 0),
      terminalId(groundComponents[i].id, 0)
    );
  }
  const groundNodeId = groundComponents.length
    ? uf.find(terminalId(groundComponents[0].id, 0))
    : "__gnd__";

  // Build terminal → node map
  const terminalToNode = new Map<string, string>();
  const nodeSet = new Set<string>();

  for (const c of components) {
    const pinCount = c.type === "ground" ? 1 : 2;
    for (let i = 0; i < pinCount; i++) {
      const tid = terminalId(c.id, i);
      const nid = uf.find(tid);
      terminalToNode.set(tid, nid);
      if (nid !== groundNodeId) nodeSet.add(nid);
    }
  }

  return {
    terminalToNode,
    nodes: Array.from(nodeSet),
    groundNodeId,
  };
}

/**
 * Returns the node ID for a given component pin, or null if it doesn't exist.
 */
export function nodeOfPin(
  netlist: Netlist,
  componentId: string,
  pinIndex: number
): string | null {
  return netlist.terminalToNode.get(terminalId(componentId, pinIndex)) ?? null;
}
