import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  const levels = await sql`SELECT id, code, name FROM level`;
  console.log("=== Levels ===");
  for (const l of levels) console.log(`  ${(l.id as string).slice(0, 8)} | ${l.code} | ${l.name}`);

  const problems = await sql`
    SELECT p.code, p.name, s.name as sn, l.name as ln
    FROM problem p
    LEFT JOIN subject s ON s.id = p.subject_id
    LEFT JOIN level l ON l.id = p.level_id
    WHERE s.name IN ('簿記', '財表')
    ORDER BY s.name, p.code
    LIMIT 30
  `;
  console.log("\n=== 簿記/財表 problems with levels ===");
  for (const p of problems) {
    console.log(`  ${p.code} | ${p.sn} | level=${p.ln ?? "null"} | ${p.name ?? ""}`);
  }

  await sql.end();
}
main();
