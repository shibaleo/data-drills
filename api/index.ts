import { handle } from "hono/vercel";
import app from "../src/lib/hono-app";

export default handle(app);
