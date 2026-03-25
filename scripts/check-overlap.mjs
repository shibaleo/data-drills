import postgres from "postgres";

const LD_URL = "postgresql://postgres.sbvcwhnzecwpydgfbgup:AFWRpmsaGutRUArx@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres";
const DD_URL = process.env.DATABASE_URL;

const ld = postgres(LD_URL, { max: 1, ssl: { rejectUnauthorized: false } });
const dd = postgres(DD_URL, { max: 1, ssl: { rejectUnauthorized: false } });

const LD_TAX = "d80f8fc5-01ea-473d-b16e-8b0c6053098c";
const LD_CPA = "db8494bd-9d43-41ad-897f-147167692753";

async function main() {
  const ldTaxProblems = await ld`SELECT id FROM learning.problems WHERE project_id = ${LD_TAX}`;
  const ldCpaProblems = await ld`SELECT id FROM learning.problems WHERE project_id = ${LD_CPA}`;
  const ddProblems = await dd`SELECT id FROM problem`;
  const ddIds = new Set(ddProblems.map(r => r.id));

  console.log("=== Problem overlap ===");
  console.log("LD tax:", ldTaxProblems.length, "| overlap:", ldTaxProblems.filter(r => ddIds.has(r.id)).length);
  console.log("LD CPA:", ldCpaProblems.length, "| overlap:", ldCpaProblems.filter(r => ddIds.has(r.id)).length);

  const ldTaxFc = await ld`SELECT id FROM learning.flashcards WHERE project_id = ${LD_TAX}`;
  const ldCpaFc = await ld`SELECT id FROM learning.flashcards WHERE project_id = ${LD_CPA}`;
  const ddFc = await dd`SELECT id FROM flashcard`;
  const ddFcIds = new Set(ddFc.map(r => r.id));

  console.log("\n=== Flashcard overlap ===");
  console.log("LD tax:", ldTaxFc.length, "| overlap:", ldTaxFc.filter(r => ddFcIds.has(r.id)).length);
  console.log("LD CPA:", ldCpaFc.length, "| overlap:", ldCpaFc.filter(r => ddFcIds.has(r.id)).length);

  const ldTaxAnswers = await ld`SELECT a.id FROM learning.answers a JOIN learning.problems p ON a.problem_id = p.id WHERE p.project_id = ${LD_TAX}`;
  const ldCpaAnswers = await ld`SELECT a.id FROM learning.answers a JOIN learning.problems p ON a.problem_id = p.id WHERE p.project_id = ${LD_CPA}`;
  const ddAnswers = await dd`SELECT id FROM answer`;
  const ddAIds = new Set(ddAnswers.map(r => r.id));

  console.log("\n=== Answer overlap ===");
  console.log("LD tax:", ldTaxAnswers.length, "| overlap:", ldTaxAnswers.filter(r => ddAIds.has(r.id)).length);
  console.log("LD CPA:", ldCpaAnswers.length, "| overlap:", ldCpaAnswers.filter(r => ddAIds.has(r.id)).length);

  const ldTaxReviews = await ld`SELECT r.id FROM learning.reviews r JOIN learning.answers a ON r.answer_id = a.id JOIN learning.problems p ON a.problem_id = p.id WHERE p.project_id = ${LD_TAX}`;
  const ldCpaReviews = await ld`SELECT r.id FROM learning.reviews r JOIN learning.answers a ON r.answer_id = a.id JOIN learning.problems p ON a.problem_id = p.id WHERE p.project_id = ${LD_CPA}`;
  const ddReviews = await dd`SELECT id FROM review`;
  const ddRIds = new Set(ddReviews.map(r => r.id));

  console.log("\n=== Review overlap ===");
  console.log("LD tax:", ldTaxReviews.length, "| overlap:", ldTaxReviews.filter(r => ddRIds.has(r.id)).length);
  console.log("LD CPA:", ldCpaReviews.length, "| overlap:", ldCpaReviews.filter(r => ddRIds.has(r.id)).length);

  await ld.end();
  await dd.end();
}

main().catch(e => { console.error(e); process.exit(1); });
