import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  // Get project ID (should be just one)
  const [project] = await sql`SELECT id FROM project LIMIT 1`;
  if (!project) {
    console.error("No project found");
    process.exit(1);
  }

  // Check if skill-test level already exists
  const existing = await sql`
    SELECT id FROM level WHERE project_id = ${project.id} AND code = 'skill-test'
  `;
  if (existing.length > 0) {
    console.log("skill-test level already exists:", existing[0].id);
    await sql.end();
    return;
  }

  // Get max sort_order
  const [{ max }] = await sql`SELECT COALESCE(MAX(sort_order), 0) as max FROM level WHERE project_id = ${project.id}`;

  const [created] = await sql`
    INSERT INTO level (id, code, name, project_id, sort_order)
    VALUES (gen_random_uuid(), 'skill-test', '実力', ${project.id}, ${Number(max) + 1})
    RETURNING id, code, name
  `;
  console.log("Created:", created);

  await sql.end();
}
main();
