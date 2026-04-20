import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

  const levels = await sql`SELECT id, code, name FROM level ORDER BY sort_order`;
  console.log("=== All Levels ===");
  for (const l of levels)
    console.log(`  ${(l.id as string).slice(0, 8)} | code=${l.code} | name=${l.name}`);

  const themeProblems = await sql`
    SELECT p.code, p.name, s.name as sn, l.name as ln, l.code as lc
    FROM problem p
    LEFT JOIN subject s ON s.id = p.subject_id
    LEFT JOIN level l ON l.id = p.level_id
    WHERE l.code IN ('theme-exec', 'skill-test')
    ORDER BY l.code, s.name, p.code
    LIMIT 30
  `;
  console.log("\n=== テーマ/実力テスト problems ===");
  if (themeProblems.length === 0) {
    console.log("  (none)");
  }
  for (const p of themeProblems) {
    console.log(`  ${p.lc} | ${p.sn} | code=${p.code} | name=${p.name ?? ""}`);
  }

  await sql.end();
}
main();
