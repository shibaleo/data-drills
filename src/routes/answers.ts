import { Hono } from "hono";
import { db } from "@/lib/db";
import { answer } from "@/lib/db/schema";
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
  const values = {
    problemId: body.problem_id as string,
    date: body.date as string,
    duration: (body.duration ?? null) as number | null,
    answerStatusId: (body.answer_status_id ?? null) as string | null,
    ...(body.id ? { id: body.id as string } : {}),
  };
  const [row] = await db.insert(answer).values(values).returning();
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
  if (body.answer_status_id !== undefined) updates.answerStatusId = body.answer_status_id;
  const [row] = await db.update(answer).set(updates).where(eq(answer.id, c.req.param("id"))).returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({ data: row });
});

app.delete("/:id", async (c) => {
  const [row] = await db.delete(answer).where(eq(answer.id, c.req.param("id"))).returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({ data: row });
});

export default app;
