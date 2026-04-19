import { handle } from "hono/vercel";
import app from "../packages/api/src/app.js";

export const config = {
  runtime: "edge",
};

export default handle(app);
