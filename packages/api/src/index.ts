import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { circuitRoutes } from "./routes/circuit.js";
import { simulateRoutes } from "./routes/simulate.js";
import { aiRoutes } from "./routes/ai.js";

const app = new Hono();

app.use("*", cors({ origin: "*" }));

app.route("/api/circuit", circuitRoutes);
app.route("/api/simulate", simulateRoutes);
app.route("/api/ai", aiRoutes);

app.get("/health", (c) => c.json({ ok: true }));

const PORT = Number(process.env.PORT ?? 3001);

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`🔌 CircuitSim API listening on http://localhost:${PORT}`);
});
