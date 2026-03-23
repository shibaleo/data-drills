import postgres from "postgres";
const LD_DB_URL = "postgresql://postgres.sbvcwhnzecwpydgfbgup:AFWRpmsaGutRUArx@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres";
const ldDb = postgres(LD_DB_URL, { max: 1, idle_timeout: 10, connect_timeout: 15, ssl: { rejectUnauthorized: false } });
const LD_PROJECT_ID = "d80f8fc5-01ea-473d-b16e-8b0c6053098c";
const files = await ldDb`SELECT pf.id, pf.gdrive_file_id, pf.file_name FROM learning.problem_files pf JOIN learning.problems p ON pf.problem_id = p.id WHERE p.project_id = ${LD_PROJECT_ID}`;
console.log("LD File IDs:");
for (const f of files) console.log(`  ${f.id} | ${f.file_name}`);
await ldDb.end();
