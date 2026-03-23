/**
 * Bootstrap script: creates the initial API key and admin user for data-drills.
 *
 * Usage:
 *   pnpm bootstrap <email> [password]
 *
 * If password is omitted, a random one is generated.
 */

import "dotenv/config";
import postgres from "postgres";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";

const ADMIN_EMAIL = process.argv[2];
const ADMIN_PASSWORD = process.argv[3] || crypto.randomBytes(12).toString("base64url");
const ADMIN_NAME = process.argv[4] || "管理者";

function upsertEnvVar(content: string, key: string, value: string): string {
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(content)) {
    return content.replace(re, `${key}=${value}`);
  }
  return content.trimEnd() + `\n${key}=${value}\n`;
}

async function main() {
  if (!ADMIN_EMAIL) {
    console.error("Usage: pnpm bootstrap <email> [password] [name]");
    process.exit(1);
  }

  const sql = postgres(process.env.DATABASE_URL!);

  // 1. API Key
  console.log("1. Creating initial API key...");
  const rawKey = crypto.randomBytes(32).toString("base64url");
  const fullKey = `dd_${rawKey}`;
  const keyHash = await bcrypt.hash(rawKey, 10);
  const keyPrefix = fullKey.slice(0, 11);

  await sql`
    INSERT INTO api_key (id, name, key_hash, key_prefix, is_active, created_at)
    VALUES (gen_random_uuid(), 'admin', ${keyHash}, ${keyPrefix}, true, now())
  `;
  console.log(`   API Key: ${fullKey}`);

  // 2. Create admin user
  console.log(`2. Creating admin user: ${ADMIN_EMAIL}`);
  const [created] = await sql`
    INSERT INTO "user" (id, email, name, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), ${ADMIN_EMAIL}, ${ADMIN_NAME}, true, now(), now())
    RETURNING id
  `;
  console.log(`   User ID: ${created.id}`);

  // 3. Set password
  console.log("3. Setting password...");
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await sql`
    INSERT INTO user_credential (user_id, password_hash, updated_at)
    VALUES (${created.id}, ${passwordHash}, now())
  `;
  console.log("   done.");

  // 4. Generate JWT_SECRET
  const jwtSecret = crypto.randomBytes(32).toString("base64url");

  // 5. Update .env
  console.log("4. Updating .env...");
  const envPath = path.resolve(__dirname, "../.env");
  let envContent = fs.readFileSync(envPath, "utf-8");
  envContent = upsertEnvVar(envContent, "ADMIN_API_KEY", fullKey);
  envContent = upsertEnvVar(envContent, "JWT_SECRET", jwtSecret);
  fs.writeFileSync(envPath, envContent, "utf-8");
  console.log("   done.");

  await sql.end();

  // Summary
  console.log("\n========================================");
  console.log("  Bootstrap complete");
  console.log("========================================");
  console.log(`\nADMIN_API_KEY=${fullKey}`);
  console.log(`Admin: ${ADMIN_EMAIL}`);
  console.log(`Password: ${ADMIN_PASSWORD}`);
  console.log(`\n.env updated automatically.`);
}

main().catch((e) => {
  console.error("Bootstrap failed:", e);
  process.exit(1);
});
