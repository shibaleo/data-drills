import { Hono } from "hono";
import { db } from "@/lib/db";
import { apiKey } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const app = new Hono();

app.get("/", async (c) => {
  const rows = await db
    .select({
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      isActive: apiKey.isActive,
      lastUsedAt: apiKey.lastUsedAt,
      createdAt: apiKey.createdAt,
    })
    .from(apiKey)
    .orderBy(apiKey.createdAt);
  return c.json({ data: rows });
});

app.post("/", async (c) => {
  const body = await c.req.json();
  const rawKey = crypto.randomBytes(32).toString("base64url");
  const fullKey = `dd_${rawKey}`;
  const keyHash = await bcrypt.hash(rawKey, 10);
  const keyPrefix = fullKey.slice(0, 11);

  const [row] = await db.insert(apiKey).values({
    name: body.name,
    keyHash,
    keyPrefix,
  }).returning();

  return c.json({ data: { ...row, key: fullKey } }, 201);
});

app.delete("/:id", async (c) => {
  const [row] = await db
    .update(apiKey)
    .set({ isActive: false })
    .where(eq(apiKey.id, c.req.param("id")))
    .returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({ data: row });
});

export default app;
