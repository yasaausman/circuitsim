/**
 * Circuit CRUD routes.
 * In-memory store — clients send their full circuit state, we validate & echo.
 * Real persistence lives in the browser (localStorage).
 */

import { Hono } from "hono";
import { simulate } from "@circuitsim/engine";
import type { Circuit, SimOptions } from "@circuitsim/engine";

export const circuitRoutes = new Hono();

/** Validate a circuit payload (basic shape check) */
function isCircuit(v: unknown): v is Circuit {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    Array.isArray(c.components) &&
    Array.isArray(c.wires)
  );
}

/** POST /api/circuit/validate — check netlist integrity */
circuitRoutes.post("/validate", async (c) => {
  const body = await c.req.json();
  if (!isCircuit(body)) {
    return c.json({ ok: false, error: "Invalid circuit payload" }, 400);
  }
  // Run a quick DC solve to check for issues
  const result = simulate(body, { type: "dc" });
  if (!result.converged) {
    return c.json({ ok: false, error: result.message });
  }
  return c.json({ ok: true });
});
