/**
 * Migration: LD → DD (直接DB書き込み版)
 *
 * API 経由ではなく LD→DD を直接 SQL で移行する。
 * ON CONFLICT で重複は skip/update する。
 *
 * Usage:
 *   node --env-file=.env scripts/migrate-direct.mjs          # dry-run
 *   node --env-file=.env scripts/migrate-direct.mjs --run     # execute
 */

import postgres from "postgres";

const LD_DB_URL =
  "postgresql://postgres.sbvcwhnzecwpydgfbgup:AFWRpmsaGutRUArx@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres";
const DD_DB_URL = process.env.DATABASE_URL;
const DRY_RUN = !process.argv.includes("--run");

const PROJECT_MAP = [
  { ldId: "d80f8fc5-01ea-473d-b16e-8b0c6053098c", ddId: "639048c0-db94-4bb4-8be3-68e652d40e4e", name: "税理士" },
  { ldId: "db8494bd-9d43-41ad-897f-147167692753", ddId: "d57b60dc-a95e-406e-94a4-06ac70024a98", name: "公認会計士" },
];

const ld = postgres(LD_DB_URL, { max: 1, idle_timeout: 10, connect_timeout: 15, ssl: { rejectUnauthorized: false } });
const dd = postgres(DD_DB_URL, { max: 1, idle_timeout: 10, connect_timeout: 15, ssl: { rejectUnauthorized: false } });

let stats = { created: 0, skipped: 0, errors: 0 };

function randomCode() { return Math.random().toString(36).slice(2, 8); }

async function migrateProject(LD_PID, DD_PID, name) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${name}`);
  console.log(`${"=".repeat(60)}\n`);

  // ── Subject/Level mapping ──
  const ldSubjects = await ld`SELECT * FROM learning.project_subjects WHERE project_id = ${LD_PID}`;
  const ldLevels = await ld`SELECT * FROM learning.project_levels WHERE project_id = ${LD_PID}`;
  const ddSubjects = await dd`SELECT id, name FROM subject WHERE project_id = ${DD_PID}`;
  const ddLevels = await dd`SELECT id, name FROM level WHERE project_id = ${DD_PID}`;

  const subjectMap = new Map();
  for (const l of ldSubjects) {
    const d = ddSubjects.find(s => s.name === l.name);
    if (d) { subjectMap.set(l.id, d.id); console.log(`  subject: ${l.name} → ${d.id}`); }
    else console.log(`  subject: ${l.name} → NOT FOUND`);
  }
  const levelMap = new Map();
  for (const l of ldLevels) {
    const d = ddLevels.find(s => s.name === l.name);
    if (d) { levelMap.set(l.id, d.id); console.log(`  level: ${l.name} → ${d.id}`); }
    else console.log(`  level: ${l.name} → NOT FOUND`);
  }

  // ── Problems ──
  const problems = await ld`SELECT * FROM learning.problems WHERE project_id = ${LD_PID} ORDER BY created_at`;
  console.log(`\n── Problems (${problems.length}) ──`);
  if (!DRY_RUN) {
    for (const r of problems) {
      try {
        await dd`INSERT INTO problem (id, code, project_id, subject_id, level_id, name, checkpoint)
          VALUES (${r.id}, ${r.code || randomCode()}, ${DD_PID},
            ${r.subject_id ? subjectMap.get(r.subject_id) ?? null : null},
            ${r.level_id ? levelMap.get(r.level_id) ?? null : null},
            ${r.name ?? null}, ${r.checkpoint ?? null})
          ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, checkpoint = EXCLUDED.checkpoint`;
        stats.created++;
      } catch (e) { stats.errors++; console.error(`  ✗ problem ${r.code}: ${e.message.slice(0, 120)}`); }
    }
    console.log(`  done (${problems.length})`);
  } else { stats.created += problems.length; console.log(`  [dry] ${problems.length} problems`); }

  // ── Problem Files ──
  const files = await ld`SELECT pf.* FROM learning.problem_files pf JOIN learning.problems p ON pf.problem_id = p.id WHERE p.project_id = ${LD_PID}`;
  console.log(`\n── Problem Files (${files.length}) ──`);
  if (!DRY_RUN) {
    for (const r of files) {
      try {
        await dd`INSERT INTO problem_file (id, problem_id, gdrive_file_id, file_name)
          VALUES (${r.id}, ${r.problem_id}, ${r.gdrive_file_id}, ${r.file_name ?? null})
          ON CONFLICT (id) DO NOTHING`;
        stats.created++;
      } catch (e) { stats.errors++; console.error(`  ✗ file: ${e.message.slice(0, 120)}`); }
    }
    console.log(`  done (${files.length})`);
  } else { stats.created += files.length; console.log(`  [dry] ${files.length} files`); }

  // ── Topics (from flashcard.topic text) ──
  const flashcards = await ld`SELECT * FROM learning.flashcards WHERE project_id = ${LD_PID} ORDER BY created_at`;
  const ddTopics = await dd`SELECT id, name FROM topic WHERE project_id = ${DD_PID}`;
  const topicMap = new Map();
  for (const t of ddTopics) topicMap.set(t.name, t.id);

  for (const r of flashcards) {
    const name = r.topic?.trim();
    if (name && !topicMap.has(name)) {
      const id = crypto.randomUUID();
      topicMap.set(name, id);
      if (!DRY_RUN) {
        try {
          await dd`INSERT INTO topic (id, code, name, project_id) VALUES (${id}, ${randomCode()}, ${name}, ${DD_PID})
            ON CONFLICT DO NOTHING`;
        } catch { /* ignore */ }
      }
      console.log(`  topic: ${name}`);
    }
  }

  // ── Tags (from flashcard.tags array + review_type) ──
  const ddTags = await dd`SELECT id, name FROM tag`;
  const tagMap = new Map();
  for (const t of ddTags) tagMap.set(t.name, t.id);

  const allTagNames = new Set();
  for (const r of flashcards) {
    if (Array.isArray(r.tags)) r.tags.forEach(t => { if (t?.trim()) allTagNames.add(t.trim()); });
  }
  // Also collect review_types
  const ldReviews = await ld`SELECT r.* FROM learning.reviews r JOIN learning.answers a ON r.answer_id = a.id JOIN learning.problems p ON a.problem_id = p.id WHERE p.project_id = ${LD_PID} ORDER BY r.created_at`;
  for (const r of ldReviews) {
    if (r.review_type?.trim()) allTagNames.add(r.review_type.trim());
  }

  for (const name of allTagNames) {
    if (!tagMap.has(name)) {
      const id = crypto.randomUUID();
      tagMap.set(name, id);
      if (!DRY_RUN) {
        try {
          await dd`INSERT INTO tag (id, code, name) VALUES (${id}, ${randomCode()}, ${name})
            ON CONFLICT DO NOTHING`;
        } catch { /* ignore */ }
      }
      console.log(`  tag: ${name}`);
    }
  }

  // ── Flashcards ──
  console.log(`\n── Flashcards (${flashcards.length}) ──`);
  if (!DRY_RUN) {
    for (const r of flashcards) {
      const topicId = r.topic?.trim() ? topicMap.get(r.topic.trim()) ?? null : null;
      try {
        await dd`INSERT INTO flashcard (id, code, project_id, topic_id, front, back)
          VALUES (${r.id}, ${randomCode()}, ${DD_PID}, ${topicId}, ${r.front ?? ""}, ${r.back ?? ""})
          ON CONFLICT (id) DO NOTHING`;
        stats.created++;
      } catch (e) { stats.errors++; console.error(`  ✗ fc: ${e.message.slice(0, 120)}`); }

      // Tags
      if (Array.isArray(r.tags)) {
        for (const t of r.tags) {
          const tagId = t?.trim() ? tagMap.get(t.trim()) : null;
          if (tagId) {
            try {
              await dd`INSERT INTO flashcard_tag (flashcard_id, tag_id) VALUES (${r.id}, ${tagId})
                ON CONFLICT DO NOTHING`;
            } catch { /* ignore */ }
          }
        }
      }
    }
    console.log(`  done (${flashcards.length})`);
  } else { stats.created += flashcards.length; console.log(`  [dry] ${flashcards.length} flashcards`); }

  // ── FC-Problem links ──
  const fcProblems = await ld`SELECT fp.* FROM learning.flashcard_problems fp JOIN learning.flashcards f ON fp.flashcard_id = f.id WHERE f.project_id = ${LD_PID}`;
  if (fcProblems.length > 0) {
    console.log(`\n── FC-Problem links (${fcProblems.length}) ──`);
    if (!DRY_RUN) {
      for (const r of fcProblems) {
        try {
          await dd`INSERT INTO flashcard_problem (flashcard_id, problem_id) VALUES (${r.flashcard_id}, ${r.problem_id})
            ON CONFLICT DO NOTHING`;
        } catch { /* ignore */ }
      }
      console.log(`  done`);
    }
  }

  // ── FC Reviews ──
  const fcReviews = await ld`SELECT fr.* FROM learning.flashcard_reviews fr JOIN learning.flashcards f ON fr.flashcard_id = f.id WHERE f.project_id = ${LD_PID} ORDER BY fr.created_at`;
  if (fcReviews.length > 0) {
    console.log(`\n── FC Reviews (${fcReviews.length}) ──`);
    if (!DRY_RUN) {
      for (const r of fcReviews) {
        try {
          await dd`INSERT INTO flashcard_review (id, flashcard_id, quality, reviewed_at)
            VALUES (${r.id}, ${r.flashcard_id}, ${r.quality}, ${r.date ?? r.created_at})
            ON CONFLICT (id) DO NOTHING`;
        } catch { /* ignore */ }
      }
      console.log(`  done`);
    }
  }

  // ── Answers ──
  const ddStatuses = await dd`SELECT id, name FROM answer_status`;
  const statusMap = new Map();
  for (const s of ddStatuses) statusMap.set(s.name, s.id);

  const ldAnswers = await ld`SELECT a.* FROM learning.answers a JOIN learning.problems p ON a.problem_id = p.id WHERE p.project_id = ${LD_PID} ORDER BY a.date`;
  console.log(`\n── Answers (${ldAnswers.length}) ──`);
  if (!DRY_RUN) {
    for (const a of ldAnswers) {
      const dateStr = a.date ? new Date(a.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
      let dur = null;
      if (a.duration) {
        const m = String(a.duration).match(/^(\d+):(\d+):(\d+)$/);
        if (m) dur = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]);
      }
      const statusId = a.status ? statusMap.get(a.status) ?? null : null;
      try {
        await dd`INSERT INTO answer (id, problem_id, date, duration, answer_status_id)
          VALUES (${a.id}, ${a.problem_id}, ${dateStr}, ${dur}, ${statusId})
          ON CONFLICT (id) DO NOTHING`;
        stats.created++;
      } catch (e) { stats.errors++; console.error(`  ✗ answer: ${e.message.slice(0, 120)}`); }
    }
    console.log(`  done (${ldAnswers.length})`);
  } else { stats.created += ldAnswers.length; console.log(`  [dry] ${ldAnswers.length} answers`); }

  // ── Reviews + Review Tags ──
  console.log(`\n── Reviews (${ldReviews.length}) ──`);
  if (!DRY_RUN) {
    for (const r of ldReviews) {
      try {
        await dd`INSERT INTO review (id, answer_id, content)
          VALUES (${r.id}, ${r.answer_id}, ${r.content ?? null})
          ON CONFLICT (id) DO NOTHING`;
        stats.created++;
      } catch (e) { stats.errors++; console.error(`  ✗ review: ${e.message.slice(0, 120)}`); }

      if (r.review_type?.trim()) {
        const tagId = tagMap.get(r.review_type.trim());
        if (tagId) {
          try {
            await dd`INSERT INTO review_tag (review_id, tag_id) VALUES (${r.id}, ${tagId})
              ON CONFLICT DO NOTHING`;
          } catch { /* ignore */ }
        }
      }
    }
    console.log(`  done (${ldReviews.length})`);
  } else { stats.created += ldReviews.length; console.log(`  [dry] ${ldReviews.length} reviews`); }
}

async function main() {
  console.log(`=== LD→DD Direct Migration ${DRY_RUN ? "(DRY RUN)" : "(EXECUTING)"} ===\n`);
  await ld`SELECT 1`; console.log("LD DB: OK");
  await dd`SELECT 1`; console.log("DD DB: OK");

  for (const p of PROJECT_MAP) {
    await migrateProject(p.ldId, p.ddId, p.name);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  TOTAL: Created: ${stats.created} | Skipped: ${stats.skipped} | Errors: ${stats.errors}`);
  console.log(`${"=".repeat(60)}`);
  await ld.end(); await dd.end();
}

main().catch(e => { console.error("Fatal:", e); ld.end(); dd.end(); process.exit(1); });
