import { Hono } from "hono";
import { db } from "@/lib/db";
import { problem, answer, answerStatus } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { computeNextReview, computeDaysOverdue } from "@/lib/fsrs";
import { toJSTDateString } from "@/lib/date-utils";
import type { AnswerStatus } from "@/lib/types";
import { problemColor } from "@/lib/problem-color";

const app = new Hono();

/**
 * GET / — プロジェクトの復習スケジュールを返す
 *
 * problems + latest answer のみ取得し、サーバーサイドで FSRS 計算。
 * /problems-detail (6テーブル全件) より大幅に軽量。
 */
app.get("/", async (c) => {
  const projectId = c.req.query("project_id");
  if (!projectId) return c.json({ error: "project_id is required" }, 400);

  const problems = await db.select().from(problem)
    .where(eq(problem.projectId, projectId))
    .orderBy(problem.createdAt);

  const problemIds = problems.map((p) => p.id);
  if (problemIds.length === 0) {
    return c.json({ data: [] });
  }

  const [answers, statuses] = await Promise.all([
    db.select().from(answer)
      .where(inArray(answer.problemId, problemIds))
      .orderBy(answer.date),
    db.select().from(answerStatus),
  ]);

  // Build status name lookup
  const statusNameMap = new Map(statuses.map((s) => [s.id, s.name]));

  // Find latest answer per problem + count
  const latestAnswer = new Map<string, { date: string; duration: number | null; answerStatusId: string | null }>();
  const answerCounts = new Map<string, number>();
  for (const a of answers) {
    answerCounts.set(a.problemId, (answerCounts.get(a.problemId) ?? 0) + 1);
    const cur = latestAnswer.get(a.problemId);
    if (!cur || a.date > cur.date) {
      latestAnswer.set(a.problemId, {
        date: a.date,
        duration: a.duration,
        answerStatusId: a.answerStatusId,
      });
    }
  }

  const today = toJSTDateString(new Date());

  const data = problems.map((p) => {
    const latest = latestAnswer.get(p.id);
    let lastStatus: AnswerStatus;
    let nextReview: string;
    let daysUntil: number;

    if (!latest) {
      lastStatus = "Yet";
      nextReview = today;
      daysUntil = 0;
    } else {
      lastStatus = (latest.answerStatusId
        ? statusNameMap.get(latest.answerStatusId) as AnswerStatus
        : null) ?? "Yet";
      nextReview = computeNextReview(
        latest.date, lastStatus, p.standardTime, latest.duration,
      );
      daysUntil = -computeDaysOverdue(nextReview, today);
    }

    const color = problemColor(
      p.code,
      p.name ?? "",
      null, // subjectColor is resolved client-side from lookup
    );

    return {
      problemId: p.id,
      code: p.code,
      name: p.name ?? "",
      subjectId: p.subjectId,
      levelId: p.levelId,
      lastStatus,
      nextReview,
      daysUntil,
      answerCount: answerCounts.get(p.id) ?? 0,
      color,
    };
  });

  return c.json({ data });
});

export default app;
