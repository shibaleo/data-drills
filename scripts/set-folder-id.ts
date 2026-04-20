import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  await sql`UPDATE project SET gdrive_folder_id = '14hBoaXTFK2s_3oY3XkX-Pwx4XB_mxxht'`;
  const [p] = await sql`SELECT id, code, name, gdrive_folder_id FROM project LIMIT 1`;
  console.log("Updated:", p);
  await sql.end();
}
main();
