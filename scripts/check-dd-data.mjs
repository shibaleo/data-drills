import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 1, idle_timeout: 5, connect_timeout: 10 });
const DD_PROJECT_ID = "639048c0-db94-4bb4-8be3-68e652d40e4e";

try {
  // Check topics
  const topics = await sql`SELECT * FROM topic WHERE project_id = ${DD_PROJECT_ID} ORDER BY name`;
  console.log(`\n=== Topics (${topics.length}) ===`);
  for (const t of topics) console.log(`  ${t.id} | ${t.code} | ${t.name}`);

  // Check for duplicate topic names
  const dupTopics = await sql`
    SELECT name, COUNT(*) as cnt FROM topic WHERE project_id = ${DD_PROJECT_ID}
    GROUP BY name HAVING COUNT(*) > 1`;
  if (dupTopics.length > 0) {
    console.log(`\n⚠ Duplicate topics:`);
    for (const d of dupTopics) console.log(`  "${d.name}" x${d.cnt}`);
  }

  // Check problem files
  const files = await sql`
    SELECT pf.*, p.code as problem_code FROM problem_file pf
    JOIN problem p ON pf.problem_id = p.id
    WHERE p.project_id = ${DD_PROJECT_ID}`;
  console.log(`\n=== Problem Files (${files.length}) ===`);
  for (const f of files) console.log(`  ${f.id} | ${f.problem_code} | ${f.file_name}`);

  // Check for duplicate files (same problem_id + gdrive_file_id)
  const dupFiles = await sql`
    SELECT problem_id, gdrive_file_id, COUNT(*) as cnt FROM problem_file
    WHERE problem_id IN (SELECT id FROM problem WHERE project_id = ${DD_PROJECT_ID})
    GROUP BY problem_id, gdrive_file_id HAVING COUNT(*) > 1`;
  if (dupFiles.length > 0) {
    console.log(`\n⚠ Duplicate files:`);
    for (const d of dupFiles) console.log(`  problem=${d.problem_id} gdrive=${d.gdrive_file_id} x${d.cnt}`);
  }

  // Check flashcards
  const fcs = await sql`SELECT id, code, front, topic_id FROM flashcard WHERE project_id = ${DD_PROJECT_ID}`;
  console.log(`\n=== Flashcards (${fcs.length}) ===`);
  for (const f of fcs) console.log(`  ${f.id} | ${f.code} | topic=${f.topic_id} | ${(f.front ?? "").slice(0, 40)}`);

  // Check tags
  const tags = await sql`SELECT * FROM tag ORDER BY name`;
  console.log(`\n=== Tags (${tags.length}) ===`);
  for (const t of tags) console.log(`  ${t.id} | ${t.code} | ${t.name}`);

} finally {
  await sql.end();
}
