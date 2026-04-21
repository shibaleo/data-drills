// Thin entry point committed to git — Vercel detects this as a serverless function.
// The actual Hono app is bundled into _bundle.mjs by scripts/build-api.mjs at build time.
export { default } from "./_bundle.mjs";
