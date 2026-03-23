import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL, { max: 1, idle_timeout: 5, connect_timeout: 10 });
try {
  await sql`DROP INDEX IF EXISTS "problem_project_code_key"`;
  await sql`CREATE UNIQUE INDEX "problem_project_code_key" ON "problem" ("project_id", "code", "subject_id", "level_id")`;
  console.log("Index updated: (project_id, code, subject_id, level_id)");
} catch (e) {
  console.error("Error:", e.message);
} finally {
  await sql.end();
}
