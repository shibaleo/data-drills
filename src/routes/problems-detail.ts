import { Hono } from "hono";
import { db } from "@/lib/db";
import { problem, answer, review, reviewTag, tag, problemFile } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

const app = new Hono();

/**
 * GET / — プロジェクトに属する問題＋回答＋レビュー＋タグ＋ファイルを一括取得
 *
 * Timeline / Problems / Answers ページ共通で利用。
 * 1リクエスト・1DB接続で全データを返すことで Vercel serverless の接続数制限を回避する。
 */
app.get("/", async (c) => {
  const projectId = c.req.query("project_id");
  if (!projectId) return c.json({ error: "project_id is required" }, 400);

  // 1. Problems
  const problems = await db.select().from(problem)
    .where(eq(problem.projectId, projectId))
    .orderBy(problem.createdAt);

  const problemIds = problems.map((p) => p.id);

  if (problemIds.length === 0) {
    const tags = await db.select().from(tag);
    return c.json({
      data: { problems, answers: [], reviews: [], reviewTags: [], tags, problemFiles: [] },
    });
  }

  // 2. Answers (filtered by problem IDs)
  const answers = await db.select().from(answer)
    .where(inArray(answer.problemId, problemIds))
    .orderBy(answer.date);

  const answerIds = answers.map((a) => a.id);

  // 3. Reviews (filtered by answer IDs)
  const reviews = answerIds.length > 0
    ? await db.select().from(review).where(inArray(review.answerId, answerIds))
    : [];

  const reviewIds = reviews.map((r) => r.id);

  // 4. ReviewTags (filtered by review IDs)
  const reviewTags = reviewIds.length > 0
    ? await db.select().from(reviewTag).where(inArray(reviewTag.reviewId, reviewIds))
    : [];

  // 5. Tags (all)
  const tags = await db.select().from(tag);

  // 6. ProblemFiles (filtered by problem IDs)
  const problemFiles = await db.select().from(problemFile)
    .where(inArray(problemFile.problemId, problemIds));

  return c.json({
    data: { problems, answers, reviews, reviewTags, tags, problemFiles },
  });
});

export default app;
