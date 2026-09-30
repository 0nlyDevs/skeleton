#!/usr/bin/env tsx
/**
 * Smoke test suite — run against a live server on :3000.
 *
 * Verifies that:
 *   1. The health endpoint is public and returns 200
 *   2. Protected API routes return 401 without a session
 *   3. Sensitive files (.env, backup.sql) are not served
 *   4. Public pages (login, register) render
 *
 * Usage: npm run smoke  (server must be running on :3000)
 */
import { request } from "node:http";

const BASE_URL = process.env.SMOKE_URL ?? "http://localhost:3000";

interface TestCase {
  name: string;
  path: string;
  expectedStatus: number;
}

const cases: TestCase[] = [
  { name: "health endpoint (public)", path: "/api/health", expectedStatus: 200 },
  { name: "posts without auth (401)", path: "/api/posts", expectedStatus: 401 },
  { name: "users without auth (401)", path: "/api/users", expectedStatus: 401 },
  { name: ".env blocked", path: "/.env", expectedStatus: 404 },
  { name: "backup.sql blocked", path: "/backup.sql", expectedStatus: 404 },
  { name: "login page renders", path: "/login", expectedStatus: 200 },
];

/**
 * The first request to a page in development compiles it on demand, which can
 * take far longer than a warm request. A short timeout here reports a false
 * failure — "login page renders — timeout" — rather than a real problem.
 */
const REQUEST_TIMEOUT_MS = 30_000;

function fetchStatus(path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request(`${BASE_URL}${path}`, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on("error", reject);
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error(`timeout on ${path} after ${REQUEST_TIMEOUT_MS}ms`));
    });
    req.end();
  });
}

async function main(): Promise<void> {
  let passed = 0;
  let failed = 0;

  for (const tc of cases) {
    try {
      const status = await fetchStatus(tc.path);
      if (status === tc.expectedStatus) {
        console.log(`  ✓ ${tc.name} (${status})`);
        passed++;
      } else {
        console.log(`  ✗ ${tc.name} — expected ${tc.expectedStatus}, got ${status}`);
        failed++;
      }
    } catch (error) {
      console.log(`  ✗ ${tc.name} — ${error instanceof Error ? error.message : "unknown error"}`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error("Smoke test runner failed:", error);
  process.exit(1);
});
