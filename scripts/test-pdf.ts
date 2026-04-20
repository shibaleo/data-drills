/**
 * Test script: classify pages from local training PDF, extract + label, save output.
 *
 * Usage: npx tsx scripts/test-pdf.ts
 */
import "dotenv/config";
import * as fs from "fs";
import postgres from "postgres";

const TRAINING_DIR = "G:/マイドライブ/root/taxtant/training";

async function main() {
  // 1. Print existing problem codes from DB
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const subjects = await sql`SELECT id, code, name FROM subject`;
  console.log("=== Subjects ===");
  for (const s of subjects) console.log(`  ${s.id.slice(0, 8)} | ${s.code} | ${s.name}`);

  // Get 簿記 and 財表 problems specifically
  const bkId = subjects.find((s: { name: string }) => s.name === "簿記")?.id;
  const zsId = subjects.find((s: { name: string }) => s.name === "財表")?.id;
  console.log(`\n簿記 subject_id: ${bkId}`);
  console.log(`財表 subject_id: ${zsId}`);

  if (bkId) {
    const bkProblems = await sql`SELECT code, name FROM problem WHERE subject_id = ${bkId} ORDER BY code LIMIT 20`;
    console.log(`\n=== 簿記 problems (first 20) ===`);
    for (const p of bkProblems) console.log(`  code=${p.code} | name=${p.name}`);
  }
  if (zsId) {
    const zsProblems = await sql`SELECT code, name FROM problem WHERE subject_id = ${zsId} ORDER BY code LIMIT 20`;
    console.log(`\n=== 財表 problems (first 20) ===`);
    for (const p of zsProblems) console.log(`  code=${p.code} | name=${p.name}`);
  }

  // 2. Read local PDF
  const files = fs.readdirSync(TRAINING_DIR).filter((f: string) => f.endsWith(".pdf")).slice(0, 3);
  console.log(`\n=== Local PDF files (first 3) ===`);
  for (const f of files) console.log(`  ${f}`);

  const testFile = files[0];
  console.log(`\n=== Testing: ${testFile} ===`);
  const buf = fs.readFileSync(`${TRAINING_DIR}/${testFile}`);
  console.log(`  Size: ${buf.byteLength} bytes`);

  // 3. Classify pages — with debug text output
  console.log("\n=== Page classification (with text debug) ===");
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const path = await import("path");
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = path.join(
      process.cwd(),
      "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    );
  }

  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(buf),
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;

  console.log(`  Total pages: ${doc.numPages}`);

  for (let i = 1; i <= Math.min(doc.numPages, 5); i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fullText = tc.items.map((item: any) => (item.str as string) ?? "").join("");
    const lines = fullText.split(/\n/).map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    console.log(`\n  --- Page ${i} (${lines.length} lines, ${fullText.length} chars) ---`);
    console.log(`  First 6 lines:`);
    for (const l of lines.slice(0, 6)) console.log(`    "${l}"`);

    const hasProblem = lines.slice(0, 6).some((l: string) => l.startsWith("問題"));
    const hasAnswer = lines.slice(0, 6).some((l: string) => l.startsWith("解答"));
    console.log(`  hasProblem=${hasProblem} hasAnswer=${hasAnswer}`);
  }

  // 4. Use classifyPages function
  const { classifyPages, problemPageIndices, extractAndLabel } = await import("../src/lib/pdf-processing");
  // Copy buffer — pdfjs-dist detaches the original
  const bufCopy = new Uint8Array(buf).buffer;
  const types = await classifyPages(bufCopy);
  const indices = problemPageIndices(types);
  console.log(`\n=== Classification result ===`);
  console.log(`  Types: ${types.join(", ")}`);
  console.log(`  Problem indices: [${indices.join(", ")}]`);

  // 5. Extract + label if any
  if (indices.length > 0) {
    const labeled = await extractAndLabel(new Uint8Array(buf), indices, "TEST_001");
    const outPath = "scripts/test-output.pdf";
    fs.writeFileSync(outPath, labeled);
    console.log(`\n  Saved labeled PDF to ${outPath} (${labeled.byteLength} bytes)`);
  } else {
    console.log("\n  No problem pages found — skipping extraction.");
  }

  await sql.end();
  console.log("\nDone!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
