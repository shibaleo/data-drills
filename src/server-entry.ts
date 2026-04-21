import { handle } from "hono/vercel";
import app from "@/lib/hono-app";

export default handle(app);
