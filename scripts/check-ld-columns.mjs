import postgres from "postgres";

const LD_DB_URL =
  "postgresql://postgres.sbvcwhnzecwpydgfbgup:AFWRpmsaGutRUArx@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres";
const LD_PROJECT_ID = "d80f8fc5-01ea-473d-b16e-8b0c6053098c";

const ldDb = postgres(LD_DB_URL, {
  max: 1, idle_timeout: 10, connect_timeout: 15,
  ssl: { rejectUnauthorized: false },
});

// Check columns of problems table
const cols = await ldDb`
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_schema = 'learning' AND table_name = 'problems'
  ORDER BY ordinal_position`;
console.log("=== problems columns ===");
for (const c of cols) console.log(`  ${c.column_name}: ${c.data_type}`);

// Show first 3 problems
const problems = await ldDb`SELECT * FROM learning.problems WHERE project_id = ${LD_PROJECT_ID} LIMIT 3`;
console.log("\n=== Sample problems ===");
for (const p of problems) console.log(JSON.stringify(p, null, 2));

// Check flashcards columns too
const fcCols = await ldDb`
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_schema = 'learning' AND table_name = 'flashcards'
  ORDER BY ordinal_position`;
console.log("\n=== flashcards columns ===");
for (const c of fcCols) console.log(`  ${c.column_name}: ${c.data_type}`);

await ldDb.end();
