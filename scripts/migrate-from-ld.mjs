/**
 * Migration: LD 税理士 → DD 税理士 のみ
 *
 * - 既存の DD subjects/levels は名前でマッピング（新規作成しない）
 * - LD の subject_id/level_id を DD の ID に変換して problem に紐づけ
 * - 再実行安全: 既存の topics/tags を名前で検索し、重複作成しない
 *
 * Usage:
 *   node --env-file=.env scripts/migrate-from-ld.mjs          # dry-run
 *   node --env-file=.env scripts/migrate-from-ld.mjs --run     # execute
 */

import postgres from "postgres";

const LD_DB_URL =
  "postgresql://postgres.sbvcwhnzecwpydgfbgup:AFWRpmsaGutRUArx@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres";
const DD_BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "http://127.0.0.1:3000";
const DD_API_KEY = process.env.ADMIN_API_KEY;
const DRY_RUN = !process.argv.includes("--run");

// ── 固定マッピング: 税理士のみ ──
const LD_PROJECT_ID = "d80f8fc5-01ea-473d-b16e-8b0c6053098c";
const DD_PROJECT_ID = "639048c0-db94-4bb4-8be3-68e652d40e4e";

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
    const err = new Error(`${method} ${path} → ${res.status}: ${text}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function randomCode() { return Math.random().toString(36).slice(2, 8); }

function isDuplicateError(e) {
  const msg = e.message || "";
  return msg.includes("23505")
    || msg.includes("duplicate")
    || msg.includes("unique")
    || msg.includes("violates")
    || msg.includes("already exists")
    || msg.includes("conflict")
    || (e.status === 500 && msg.includes("Failed query"));
}

let stats = { created: 0, skipped: 0, errors: 0 };

async function post(path, body, label) {
  if (DRY_RUN) {
    console.log(`  [dry] ${label}`);
    stats.created++;
    return;
  }
  try {
    await api("POST", path, body);
    stats.created++;
    console.log(`  ✓ ${label}`);
  } catch (e) {
    if (isDuplicateError(e)) {
      stats.skipped++;
      console.log(`  skip: ${label}`);
    } else {
      stats.errors++;
      console.error(`  ✗ ${label}: ${e.message.slice(0, 200)}`);
    }
  }
}

async function main() {
  console.log(`=== LD→DD 税理士 ${DRY_RUN ? "(DRY RUN)" : "(EXECUTING)"} ===\n`);

  await ldDb`SELECT 1`;
  console.log("LD DB: OK");
  await api("GET", "/health");
  console.log("DD API: OK\n");

  // ── Step 1: Build subject/level name→ID mapping ──
  console.log("── Building subject/level mapping ──");

  // Get LD subjects & levels
  const ldSubjects = await ldDb`SELECT * FROM learning.project_subjects WHERE project_id = ${LD_PROJECT_ID}`;
  const ldLevels = await ldDb`SELECT * FROM learning.project_levels WHERE project_id = ${LD_PROJECT_ID}`;

  // Get DD subjects & levels
  const ddSubjects = (await api("GET", `/projects/${DD_PROJECT_ID}/subjects?limit=100`)).data;
  const ddLevels = (await api("GET", `/projects/${DD_PROJECT_ID}/levels?limit=100`)).data;

  // Map LD ID → DD ID by name
  const subjectIdMap = new Map(); // LD subject ID → DD subject ID
  for (const ld of ldSubjects) {
    const dd = ddSubjects.find((d) => d.name === ld.name);
    if (dd) {
      subjectIdMap.set(ld.id, dd.id);
      console.log(`  subject: ${ld.name} → ${dd.id}`);
    } else {
      console.log(`  subject: ${ld.name} → NOT FOUND in DD (will be null)`);
    }
  }

  const levelIdMap = new Map(); // LD level ID → DD level ID
  for (const ld of ldLevels) {
    const dd = ddLevels.find((d) => d.name === ld.name);
    if (dd) {
      levelIdMap.set(ld.id, dd.id);
      console.log(`  level: ${ld.name} → ${dd.id}`);
    } else {
      console.log(`  level: ${ld.name} → NOT FOUND in DD (will be null)`);
    }
  }

  // ── Step 2: Problems (insert or update) ──
  const problems = await ldDb`SELECT * FROM learning.problems WHERE project_id = ${LD_PROJECT_ID} ORDER BY created_at`;
  console.log(`\n── Problems (${problems.length}) ──`);
  for (const r of problems) {
    const body = {
      id: r.id,
      code: r.code || randomCode(),
      project_id: DD_PROJECT_ID,
      subject_id: r.subject_id ? subjectIdMap.get(r.subject_id) ?? null : null,
      level_id: r.level_id ? levelIdMap.get(r.level_id) ?? null : null,
      name: r.name ?? null,
      checkpoint: r.checkpoint ?? null,
    };
    if (DRY_RUN) {
      console.log(`  [dry] problem ${r.code} (${r.name ?? "no name"})`);
      stats.created++;
    } else {
      try {
        await api("POST", "/problems", body);
        stats.created++;
        console.log(`  ✓ problem ${r.code} (${r.name ?? "no name"})`);
      } catch {
        // Already exists → update name/checkpoint
        try {
          await api("PUT", `/problems/${r.id}`, { name: r.name, checkpoint: r.checkpoint });
          stats.skipped++;
          console.log(`  ↻ problem ${r.code} (updated name/checkpoint)`);
        } catch (e2) {
          stats.errors++;
          console.error(`  ✗ problem ${r.code}: ${e2.message.slice(0, 200)}`);
        }
      }
    }
  }

  // ── Step 3: Problem Files ──
  const files = await ldDb`
    SELECT pf.* FROM learning.problem_files pf
    JOIN learning.problems p ON pf.problem_id = p.id
    WHERE p.project_id = ${LD_PROJECT_ID}`;
  console.log(`\n── Problem Files (${files.length}) ──`);
  for (const r of files) {
    await post(`/problems/${r.problem_id}/files`, {
      id: r.id, gdrive_file_id: r.gdrive_file_id, file_name: r.file_name ?? null,
    }, `file ${r.file_name}`);
  }

  // ── Step 4: Flashcards ──
  const flashcards = await ldDb`SELECT * FROM learning.flashcards WHERE project_id = ${LD_PROJECT_ID} ORDER BY created_at`;
  console.log(`\n── Flashcards (${flashcards.length}) ──`);

  // Topics: check existing DD topics first, create only missing ones
  const existingTopics = (await api("GET", `/projects/${DD_PROJECT_ID}/topics?limit=500`)).data;
  const topicMap = new Map(); // topic name → DD topic ID
  for (const t of existingTopics) {
    topicMap.set(t.name, t.id);
  }
  console.log(`  Existing DD topics: ${existingTopics.length}`);

  for (const r of flashcards) {
    if (r.topic?.trim() && !topicMap.has(r.topic.trim())) {
      const id = crypto.randomUUID();
      topicMap.set(r.topic.trim(), id);
      await post(`/projects/${DD_PROJECT_ID}/topics`, { id, code: randomCode(), name: r.topic.trim() }, `topic: ${r.topic.trim()}`);
    }
  }

  // Tags: check existing DD tags first, create only missing ones
  const existingTags = (await api("GET", `/tags?limit=500`)).data;
  const tagMap = new Map(); // tag name → DD tag ID
  for (const t of existingTags) {
    tagMap.set(t.name, t.id);
  }
  console.log(`  Existing DD tags: ${existingTags.length}`);

  for (const r of flashcards) {
    if (r.tags && Array.isArray(r.tags)) {
      for (const t of r.tags) {
        if (t?.trim() && !tagMap.has(t.trim())) {
          const id = crypto.randomUUID();
          tagMap.set(t.trim(), id);
          await post("/tags", { id, code: randomCode(), name: t.trim() }, `tag: ${t.trim()}`);
        }
      }
    }
  }

  // Create flashcards
  for (const r of flashcards) {
    const topicId = r.topic?.trim() ? topicMap.get(r.topic.trim()) ?? null : null;
    await post("/flashcards", {
      id: r.id, code: randomCode(), project_id: DD_PROJECT_ID,
      topic_id: topicId, front: r.front ?? "", back: r.back ?? "",
    }, `fc: ${(r.front ?? "").slice(0, 30)}`);

    if (r.tags && Array.isArray(r.tags)) {
      for (const t of r.tags) {
        const tagId = t?.trim() ? tagMap.get(t.trim()) : null;
        if (tagId) await post(`/flashcards/${r.id}/tags`, { tag_id: tagId }, `  fc-tag: ${t}`);
      }
    }
  }

  // FC-Problem links
  const fcProblems = await ldDb`
    SELECT fp.* FROM learning.flashcard_problems fp
    JOIN learning.flashcards f ON fp.flashcard_id = f.id
    WHERE f.project_id = ${LD_PROJECT_ID}`;
  if (fcProblems.length > 0) {
    console.log(`\n── FC-Problem links (${fcProblems.length}) ──`);
    for (const r of fcProblems) {
      await post(`/flashcards/${r.flashcard_id}/problems`, { problem_id: r.problem_id }, `link`);
    }
  }

  // FC Reviews
  const fcReviews = await ldDb`
    SELECT fr.* FROM learning.flashcard_reviews fr
    JOIN learning.flashcards f ON fr.flashcard_id = f.id
    WHERE f.project_id = ${LD_PROJECT_ID} ORDER BY fr.created_at`;
  if (fcReviews.length > 0) {
    console.log(`\n── FC Reviews (${fcReviews.length}) ──`);
    for (const r of fcReviews) {
      await post(`/flashcards/${r.flashcard_id}/reviews`, {
        id: r.id, quality: r.quality, reviewed_at: r.date ?? r.created_at,
      }, `review`);
    }
  }

  // ── Step 5: Answers ──
  // Map LD status name → DD answer_status ID
  const ddStatuses = (await api("GET", "/statuses?limit=100")).data;
  const statusMap = new Map(); // LD status name → DD answer_status ID
  for (const s of ddStatuses) {
    statusMap.set(s.name, s.id);
  }
  console.log(`\n── Answer status mapping ──`);
  for (const [name, id] of statusMap) {
    console.log(`  ${name} → ${id}`);
  }

  const ldAnswers = await ldDb`
    SELECT a.* FROM learning.answers a
    JOIN learning.problems p ON a.problem_id = p.id
    WHERE p.project_id = ${LD_PROJECT_ID}
    ORDER BY a.date`;
  console.log(`\n── Answers (${ldAnswers.length}) ──`);

  for (const a of ldAnswers) {
    // Convert LD date (timestamp) → DD date (YYYY-MM-DD)
    const dateStr = a.date ? new Date(a.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);

    // Convert LD duration (interval string "HH:MM:SS") → DD duration (integer seconds)
    let durationSeconds = null;
    if (a.duration) {
      const dur = String(a.duration);
      const match = dur.match(/^(\d+):(\d+):(\d+)$/);
      if (match) {
        const h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const s = parseInt(match[3], 10);
        durationSeconds = h * 3600 + m * 60 + s;
      }
    }

    // Map status
    const answerStatusId = a.status ? statusMap.get(a.status) ?? null : null;

    await post("/answers", {
      id: a.id,
      problem_id: a.problem_id,
      date: dateStr,
      duration: durationSeconds,
      answer_status_id: answerStatusId,
    }, `answer ${dateStr} ${a.status ?? ""}`);
  }

  // ── Step 6: Reviews + Review Tags ──
  // First, ensure tags exist for all review_types
  const ldReviews = await ldDb`
    SELECT r.* FROM learning.reviews r
    JOIN learning.answers a ON r.answer_id = a.id
    JOIN learning.problems p ON a.problem_id = p.id
    WHERE p.project_id = ${LD_PROJECT_ID}
    ORDER BY r.created_at`;
  console.log(`\n── Reviews (${ldReviews.length}) ──`);

  // Refresh tag map (may have been updated by flashcard migration)
  const latestTags = (await api("GET", "/tags?limit=500")).data;
  const reviewTagMap = new Map(); // tag name → DD tag ID
  for (const t of latestTags) {
    reviewTagMap.set(t.name, t.id);
  }

  // Collect unique review_types that need tags
  const neededTypes = new Set();
  for (const r of ldReviews) {
    if (r.review_type?.trim()) neededTypes.add(r.review_type.trim());
  }
  for (const typeName of neededTypes) {
    if (!reviewTagMap.has(typeName)) {
      const id = crypto.randomUUID();
      reviewTagMap.set(typeName, id);
      await post("/tags", { id, code: randomCode(), name: typeName }, `tag: ${typeName}`);
    }
  }

  // Create reviews and link tags
  for (const r of ldReviews) {
    await post("/reviews", {
      id: r.id,
      answer_id: r.answer_id,
      content: r.content ?? null,
    }, `review ${(r.content ?? "").slice(0, 40)}`);

    // Link review_type as tag
    if (r.review_type?.trim()) {
      const tagId = reviewTagMap.get(r.review_type.trim());
      if (tagId) {
        await post(`/reviews/${r.id}/tags`, { tag_id: tagId }, `  review-tag: ${r.review_type}`);
      }
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`Created: ${stats.created} | Skipped: ${stats.skipped} | Errors: ${stats.errors}`);
  await ldDb.end();
}

main().catch((e) => { console.error("Fatal:", e); ldDb.end(); process.exit(1); });
