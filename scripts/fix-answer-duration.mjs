/**
 * Fix: Update answer.duration from minutes → seconds by re-reading from LD.
 *
 * Usage:
 *   node --env-file=.env scripts/fix-answer-duration.mjs          # dry-run
 *   node --env-file=.env scripts/fix-answer-duration.mjs --run     # execute
 */

import postgres from "postgres";

const LD_DB_URL =
  "postgresql://postgres.sbvcwhnzecwpydgfbgup:AFWRpmsaGutRUArx@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres";
const DD_BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "http://127.0.0.1:3000";
const DD_API_KEY = process.env.ADMIN_API_KEY;
const DRY_RUN = !process.argv.includes("--run");

const LD_PROJECT_ID = "d80f8fc5-01ea-473d-b16e-8b0c6053098c";

const ldDb = postgres(LD_DB_URL, {
  max: 1, idle_timeout: 10, connect_timeout: 15,
  ssl: { rejectUnauthorized: false },
});

async function api(method, path, body) {
  const res = await fetch(`${DD_BASE}/api/v1${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${DD_API_KEY}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

async function main() {
  console.log(`=== Fix answer durations (minutes → seconds) ${DRY_RUN ? "(DRY RUN)" : "(EXECUTING)"} ===\n`);

  await ldDb`SELECT 1`;
  console.log("LD DB: OK");
  await api("GET", "/health");
  console.log("DD API: OK\n");

  const ldAnswers = await ldDb`
    SELECT a.id, a.duration FROM learning.answers a
    JOIN learning.problems p ON a.problem_id = p.id
    WHERE p.project_id = ${LD_PROJECT_ID}`;

  let updated = 0;
  let skipped = 0;

  for (const a of ldAnswers) {
    if (!a.duration) { skipped++; continue; }

    const dur = String(a.duration);
    const match = dur.match(/^(\d+):(\d+):(\d+)$/);
    if (!match) { skipped++; continue; }

    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const s = parseInt(match[3], 10);
    const seconds = h * 3600 + m * 60 + s;

    if (DRY_RUN) {
      console.log(`  [dry] ${a.id}: "${dur}" → ${seconds}s`);
      updated++;
    } else {
      try {
        await api("PUT", `/answers/${a.id}`, { duration: seconds });
        console.log(`  ✓ ${a.id}: "${dur}" → ${seconds}s`);
        updated++;
      } catch (e) {
        console.error(`  ✗ ${a.id}: ${e.message.slice(0, 200)}`);
      }
    }
  }

  console.log(`\n=== Done: ${updated} updated, ${skipped} skipped ===`);
  await ldDb.end();
}

main().catch((e) => { console.error("Fatal:", e); ldDb.end(); process.exit(1); });
