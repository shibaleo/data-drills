import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 1, idle_timeout: 5, connect_timeout: 10 });
const DRY_RUN = !process.argv.includes("--run");

console.log(`=== Cleanup ${DRY_RUN ? "(DRY RUN)" : "(EXECUTING)"} ===\n`);

// 1. Delete duplicate topic "繰延資産" — keep the one referenced by flashcard
const KEEP_TOPIC = "2b54190b-b065-4129-977e-352e30bfb2ef";
const DELETE_TOPIC = "f0e4452d-797e-40e4-b599-9462c918c488";

console.log("── Duplicate topic cleanup ──");
console.log(`  Keep:   ${KEEP_TOPIC}`);
console.log(`  Delete: ${DELETE_TOPIC}`);
if (!DRY_RUN) {
  await sql`DELETE FROM topic WHERE id = ${DELETE_TOPIC}`;
  console.log("  ✓ Deleted duplicate topic");
}

// 2. Delete duplicate problem files — keep only files with LD IDs
const KEEP_FILE_IDS = [
  "32d00fdc-7d7d-4cf8-934e-257f7921ded5",
  "90d93025-58f0-42cd-ab35-7096911613f2",
  "1ba105ea-615c-4373-aa5c-d0830fa7b4d9",
];

console.log("\n── Duplicate problem file cleanup ──");
const DD_PROJECT_ID = "639048c0-db94-4bb4-8be3-68e652d40e4e";
const allFiles = await sql`
  SELECT pf.id FROM problem_file pf
  JOIN problem p ON pf.problem_id = p.id
  WHERE p.project_id = ${DD_PROJECT_ID}
    AND pf.id != ALL(${KEEP_FILE_IDS})`;

console.log(`  Files to delete: ${allFiles.length}`);
for (const f of allFiles) console.log(`  - ${f.id}`);
if (!DRY_RUN && allFiles.length > 0) {
  const deleteIds = allFiles.map((f) => f.id);
  await sql`DELETE FROM problem_file WHERE id = ANY(${deleteIds})`;
  console.log("  ✓ Deleted duplicate files");
}

// Verify
if (!DRY_RUN) {
  const remaining = await sql`
    SELECT COUNT(*) as cnt FROM problem_file pf
    JOIN problem p ON pf.problem_id = p.id
    WHERE p.project_id = ${DD_PROJECT_ID}`;
  console.log(`  Remaining files: ${remaining[0].cnt}`);

  const topicCount = await sql`SELECT COUNT(*) as cnt FROM topic WHERE project_id = ${DD_PROJECT_ID}`;
  console.log(`  Remaining topics: ${topicCount[0].cnt}`);
}

console.log("\n=== Done ===");
await sql.end();
