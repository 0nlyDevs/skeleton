#!/usr/bin/env node
/**
 * Production server launcher for webcup-skeleton.
 *
 * Spawns `server.cjs` in a fully detached process so it survives the parent
 * shell exiting. Reads Prisma engine paths from the Nix store or falls back
 * to node_modules. Loads .env via dotenv for CLI tooling parity.
 *
 * Usage: node scripts/start.js
 */
const { spawn } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const NIX_ENGINE_DIR =
  "/nix/store/v11kl5cjdb2lhkb6r7cx02pfp4wqs78q-prisma-engines_6-6.19.3";

const env = {
  ...process.env,
  NODE_ENV: "production",
};

if (require("fs").existsSync(`${NIX_ENGINE_DIR}/lib/libquery_engine.node`)) {
  env.PRISMA_QUERY_ENGINE_LIBRARY = `${NIX_ENGINE_DIR}/lib/libquery_engine.node`;
  env.PRISMA_SCHEMA_ENGINE_BINARY = `${NIX_ENGINE_DIR}/bin/schema-engine`;
}

const child = spawn(process.execPath, ["server.cjs"], {
  cwd: ROOT,
  detached: true,
  stdio: "inherit",
  env,
});

child.unref();
console.error(`[webcup] server starting (PID ${child.pid})`);
process.exit(0);
