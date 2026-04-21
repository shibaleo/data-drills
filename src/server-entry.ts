import { handle } from "hono/vercel";
import app from "@/lib/hono-app";

// Vercel Node.js runtime handler
const handler = handle(app);
export default handler;
