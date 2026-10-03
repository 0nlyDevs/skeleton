#!/usr/bin/env node
/**
 * Apply pending database migrations at the start of `npm run build`.
 *
 * The host builds each release from git and starts it, but nothing in that
 * pipeline runs `prisma migrate deploy`: a release that adds a table then
 * boots against a database without it and every query touching it fails.
 * Migrating here, before the new code is built, keeps code and schema in step.
 * Migrations are additive by convention, so the release still serving traffic
 * keeps working while they run.
 *
 * Skipped (with a warning) when no DATABASE_URL is available — CI builds and
 * local builds without a database — or when SKIP_MIGRATIONS=1. A failing
 * migration fails the build, so a release never goes live on a schema it
 * does not match.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envFile = path.join(ROOT, ".env");
  if (!existsSync(envFile)) return null;
  const match = readFileSync(envFile, "utf8").match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?/m);
  return match?.[1] ?? null;
}

if (process.env.SKIP_MIGRATIONS === "1") {
  console.log("[webcup] SKIP_MIGRATIONS=1 - not applying database migrations");
  process.exit(0);
}

if (!databaseUrl()) {
  console.warn("[webcup] no DATABASE_URL - skipping database migrations (run `npm run db:deploy` before starting)");
  process.exit(0);
}

console.log("[webcup] applying database migrations");
const result = spawnSync("npx", ["prisma", "migrate", "deploy"], { cwd: ROOT, stdio: "inherit", env: process.env });
if (result.status !== 0) {
  console.error("[webcup] database migrations failed - aborting the build");
  process.exit(result.status ?? 1);
}

/*
 * Test accounts: when SEED_PASSWORD is set in the host's environment, the
 * (idempotent) seed runs after the migrations so every role can sign in on
 * the deployed app. A failing seed warns but never blocks a release.
 */
if (process.env.SEED_PASSWORD) {
  console.log("[webcup] seeding test accounts");
  const seeded = spawnSync("npx", ["prisma", "db", "seed"], { cwd: ROOT, stdio: "inherit", env: process.env });
  if (seeded.status !== 0) console.warn("[webcup] seed failed - continuing the build");
}

