import postgres from "postgres";

const ldDb = postgres("postgresql://postgres.sbvcwhnzecwpydgfbgup:AFWRpmsaGutRUArx@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres", {
  max: 1, ssl: { rejectUnauthorized: false },
});

const LD_PROJECT = "d80f8fc5-01ea-473d-b16e-8b0c6053098c";

const answers = await ldDb`
  SELECT a.id, a.date, a.duration, a.status, a.problem_id
  FROM learning.answers a
  JOIN learning.problems p ON a.problem_id = p.id
  WHERE p.project_id = ${LD_PROJECT}
  ORDER BY a.date
  LIMIT 5`;

console.log("=== LD sample answers ===");
for (const d of answers) {
  console.log("date:", d.date, "duration:", JSON.stringify(d.duration), "status:", d.status);
}

const reviews = await ldDb`
  SELECT r.id, r.content, r.review_type, r.answer_id
  FROM learning.reviews r
  JOIN learning.answers a ON r.answer_id = a.id
  JOIN learning.problems p ON a.problem_id = p.id
  WHERE p.project_id = ${LD_PROJECT}
  LIMIT 5`;

console.log("\n=== LD sample reviews ===");
for (const r of reviews) {
  console.log("type:", r.review_type, "content:", (r.content || "").slice(0, 80));
}

await ldDb.end();
