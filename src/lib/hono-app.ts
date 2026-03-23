import { Hono } from "hono";
import { logger } from "hono/logger";
import { authenticate, type AuthResult } from "@/lib/auth";

type Env = { Variables: { authResult: AuthResult } };
import health from "@/routes/health";
import projects from "@/routes/projects";
import problems from "@/routes/problems";
import answers from "@/routes/answers";
import flashcards from "@/routes/flashcards";
import apiKeys from "@/routes/api-keys";
import users from "@/routes/users";
import authRoutes from "@/routes/auth";

const app = new Hono<Env>().basePath("/api/v1");

app.use("*", logger());

// Error handler
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message || "Internal Server Error" }, 500);
});

// Public routes
app.route("/health", health);
app.route("/auth", authRoutes);

// Auth middleware for all subsequent routes
app.use("*", async (c, next) => {
  const result = await authenticate(c.req.raw);
  if (!result) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("authResult", result);
  await next();
});

// Routes
app.route("/projects", projects);
app.route("/problems", problems);
app.route("/answers", answers);
app.route("/flashcards", flashcards);
app.route("/api-keys", apiKeys);
app.route("/users", users);

// /me endpoint — return authenticated user info
app.get("/me", (c) => {
  const authResult = c.get("authResult");
  return c.json({
    data: {
      id: authResult.userId,
      name: authResult.name,
      email: authResult.email,
    },
  });
});

export default app;
