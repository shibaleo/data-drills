import { Hono } from "hono";
import { logger } from "hono/logger";
import { authenticate, type AuthResult } from "@/lib/auth";

type Env = { Variables: { authResult: AuthResult } };
import health from "@/routes/health";
import projects from "@/routes/projects";
import problems from "@/routes/problems";
import answers from "@/routes/answers";
import flashcards from "@/routes/flashcards";
import flashcardReviews from "@/routes/flashcard-reviews";
import reviews from "@/routes/reviews";
import apiKeys from "@/routes/api-keys";
import users from "@/routes/users";
import authRoutes from "@/routes/auth";
import statuses from "@/routes/statuses";
import tags from "@/routes/tags";
import reviewTags from "@/routes/review-tags";
import problemFiles from "@/routes/problem-files";
import problemsDetail from "@/routes/problems-detail";
import schedule from "@/routes/schedule";
import notes from "@/routes/notes";

const app = new Hono<Env>().basePath("/api/v1");

app.use("*", logger());

// Error handler — include cause message for DB constraint errors
app.onError((err, c) => {
  console.error(err);
  const causeMsg = err.cause instanceof Error ? err.cause.message : "";
  const msg = causeMsg ? `${err.message} - ${causeMsg}` : (err.message || "Internal Server Error");
  return c.json({ error: msg }, 500);
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
app.route("/flashcard-reviews", flashcardReviews);
app.route("/reviews", reviews);
app.route("/api-keys", apiKeys);
app.route("/users", users);
app.route("/statuses", statuses);
app.route("/tags", tags);
app.route("/review-tags", reviewTags);
app.route("/problem-files", problemFiles);
app.route("/problems-detail", problemsDetail);
app.route("/schedule", schedule);
app.route("/notes", notes);

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
