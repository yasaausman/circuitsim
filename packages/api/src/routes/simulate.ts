/**
 * Simulation endpoint.
 * POST /api/simulate  { circuit, options }
 */

import { Hono } from "hono";
import { simulate } from "../../engine/src/index.js";
import type { Circuit, SimOptions } from "../../engine/src/index.js";

export const simulateRoutes = new Hono();

simulateRoutes.post("/", async (c) => {
  const body = await c.req.json<{ circuit: Circuit; options: SimOptions }>();
  if (!body?.circuit || !body?.options) {
    return c.json({ error: "Missing circuit or options" }, 400);
  }
  try {
    const result = simulate(body.circuit, body.options);
    return c.json(result);
  } catch (err) {
    return c.json({ converged: false, message: String(err) }, 500);
  }
});
