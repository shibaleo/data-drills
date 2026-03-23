import { Hono } from "hono";
import { db } from "@/lib/db";
import { answer, review } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const app = new Hono();

app.get("/", async (c) => {
  const problemId = c.req.query("problem_id");
  const rows = problemId
    ? await db.select().from(answer).where(eq(answer.problemId, problemId)).orderBy(answer.date)
    : await db.select().from(answer).orderBy(answer.date);
  return c.json({ data: rows, next_cursor: null });
});

app.post("/", async (c) => {
  const body = await c.req.json();
  const [row] = await db.insert(answer).values({
    problemId: body.problem_id,
    date: body.date,
    duration: body.duration ?? null,
    status: body.status,
  }).returning();
  return c.json({ data: row }, 201);
});

app.get("/:id", async (c) => {
  const [row] = await db.select().from(answer).where(eq(answer.id, c.req.param("id")));
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({ data: row });
});

app.put("/:id", async (c) => {
  const body = await c.req.json();
  const updates: Record<string, unknown> = {};
  if (body.date !== undefined) updates.date = body.date;
  if (body.duration !== undefined) updates.duration = body.duration;
  if (body.status !== undefined) updates.status = body.status;
  const [row] = await db.update(answer).set(updates).where(eq(answer.id, c.req.param("id"))).returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({ data: row });
});

app.delete("/:id", async (c) => {
  const [row] = await db.delete(answer).where(eq(answer.id, c.req.param("id"))).returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({ data: row });
});

// ── Reviews ──

app.get("/:id/reviews", async (c) => {
  const rows = await db.select().from(review).where(eq(review.answerId, c.req.param("id")));
  return c.json({ data: rows });
});

app.post("/:id/reviews", async (c) => {
  const body = await c.req.json();
  const [row] = await db.insert(review).values({
    answerId: c.req.param("id"),
    reviewTypeId: body.review_type_id,
    content: body.content ?? null,
  }).returning();
  return c.json({ data: row }, 201);
});

app.delete("/:id/reviews/:reviewId", async (c) => {
  const [row] = await db.delete(review).where(eq(review.id, c.req.param("reviewId"))).returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({ data: row });
});

export default app;
