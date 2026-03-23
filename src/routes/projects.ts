import { Hono } from "hono";
import { db } from "@/lib/db";
import { project, subject, level, topic } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomCode } from "@/lib/utils";

const app = new Hono();

// ── Projects CRUD ──

app.get("/", async (c) => {
  const rows = await db.select().from(project).orderBy(project.createdAt);
  return c.json({ data: rows, next_cursor: null });
});

app.post("/", async (c) => {
  const body = await c.req.json();
  const values = {
    code: (body.code || randomCode()) as string,
    name: body.name as string,
    ...(body.id ? { id: body.id as string } : {}),
  };
  const [row] = await db.insert(project).values(values).returning();
  return c.json({ data: row }, 201);
});

app.get("/:id", async (c) => {
  const [row] = await db.select().from(project).where(eq(project.id, c.req.param("id")));
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({ data: row });
});

app.put("/:id", async (c) => {
  const body = await c.req.json();
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.code !== undefined) updates.code = body.code;
  if (body.name !== undefined) updates.name = body.name;
  const [row] = await db.update(project).set(updates).where(eq(project.id, c.req.param("id"))).returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({ data: row });
});

app.delete("/:id", async (c) => {
  const [row] = await db.delete(project).where(eq(project.id, c.req.param("id"))).returning();
  if (!row) return c.json({ error: "Not found" }, 404);
  return c.json({ data: row });
});

// ── Nested master routes (subjects, levels, topics, tags, review-types) ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function masterRoutes(table: any) {
  const sub = new Hono();

  sub.get("/", async (c) => {
    const projectId = c.req.param("id")!;
    const rows = await db.select().from(table).where(eq(table.projectId, projectId)).orderBy(table.sortOrder);
    return c.json({ data: rows, next_cursor: null });
  });

  sub.post("/", async (c) => {
    const projectId = c.req.param("id")!;
    const body = await c.req.json();
    const values = {
      code: (body.code || randomCode()) as string,
      name: body.name as string,
      projectId,
      color: (body.color ?? null) as string | null,
      sortOrder: (body.sort_order ?? 0) as number,
      ...(body.id ? { id: body.id as string } : {}),
    };
    const [row] = await db.insert(table).values(values).returning();
    return c.json({ data: row }, 201);
  });

  sub.put("/:entityId", async (c) => {
    const body = await c.req.json();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.code !== undefined) updates.code = body.code;
    if (body.name !== undefined) updates.name = body.name;
    if (body.color !== undefined) updates.color = body.color;
    if (body.sort_order !== undefined) updates.sortOrder = body.sort_order;
    const [row] = await db.update(table).set(updates).where(eq(table.id, c.req.param("entityId"))).returning();
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json({ data: row });
  });

  sub.delete("/:entityId", async (c) => {
    const [row] = await db.delete(table).where(eq(table.id, c.req.param("entityId"))).returning();
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json({ data: row });
  });

  return sub;
}

app.route("/:id/subjects", masterRoutes(subject));
app.route("/:id/levels", masterRoutes(level));
app.route("/:id/topics", masterRoutes(topic));

export default app;
