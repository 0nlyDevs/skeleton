#!/usr/bin/env tsx
/**
 * Smoke test suite — run against a live server.
 *
 * Verifies that:
 *   1. The health endpoint is public and returns 200
 *   2. Protected API routes return 401 without a session
 *   3. Sensitive files (.env, backup.sql) are not served
 *   4. Public pages (login, register) render
 *   5. Security headers are actually present
 *   6. A cold page load survives the host's concurrency ceiling
 *
 * Usage: npm run smoke  (server must be running on :3000)
 */
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

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
  { name: "privacy policy renders", path: "/privacy", expectedStatus: 200 },
  { name: "terms render", path: "/terms", expectedStatus: 200 },
];

/**
 * The first request to a page in development compiles it on demand, which can
 * take far longer than a warm request. A short timeout here reports a false
 * failure — "login page renders — timeout" — rather than a real problem.
 */
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Concurrency for the cold-load probe.
 *
 * A cold `/` load pulls roughly a dozen JS chunks at once. On shared hosting
 * (cPanel/Passenger) the account is capped at a small number of simultaneous
 * requests — around eleven on the Webcup host — and requests past the cap queue
 * for ten seconds and then fail with Apache's own 500. The burst is structurally
 * larger than the pipe, which is why this failed on the live deployment.
 */
const PROBE_CONCURRENCY = 12;

interface Response {
  readonly status: number;
  readonly headers: Record<string, string | string[] | undefined>;
}

/**
 * `node:http` alone cannot fetch an `https://` target, which made
 * `SMOKE_URL=https://… npm run smoke` fail on every check. The suite was
 * therefore only ever runnable against localhost — while the failure it exists
 * to detect happens exclusively on the deployed host. Pick the module by
 * protocol so the deployed host is actually reachable.
 */
const request = BASE_URL.startsWith("https:") ? httpsRequest : httpRequest;

function get(path: string, headers: Record<string, string> = {}): Promise<Response> {
  return new Promise((resolve, reject) => {
    const req = request(`${BASE_URL}${path}`, { headers }, (res) => {
      res.resume();
      resolve({
        status: res.statusCode ?? 0,
        headers: res.headers as Record<string, string | string[] | undefined>,
      });
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

  const fail = (message: string) => {
    console.log(`  ✗ ${message}`);
    failed++;
  };
  const pass = (message: string) => {
    console.log(`  ✓ ${message}`);
    passed++;
  };

  for (const tc of cases) {
    try {
      const res = await get(tc.path);
      if (res.status === tc.expectedStatus) pass(`${tc.name} (${res.status})`);
      else fail(`${tc.name} — expected ${tc.expectedStatus}, got ${res.status}`);
    } catch (error) {
      fail(`${tc.name} — ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  // --- Security headers -------------------------------------------------
  // Absent headers are a silent regression: nothing breaks, the protection is
  // just gone. Asserting them here is cheaper than finding out during review.
  try {
    const res = await get("/login");
    const h = res.headers;
    const csp = String(h["content-security-policy"] ?? "");
    const checks: readonly (readonly [string, boolean])[] = [
      ["content-security-policy", csp.includes("default-src 'self'")],
      ["strict-transport-security (skipped over plain http)", h["strict-transport-security"] !== undefined || BASE_URL.startsWith("http://127.0.0.1") || BASE_URL.startsWith("http://localhost")],
      ["x-content-type-options", String(h["x-content-type-options"] ?? "").includes("nosniff")],
      ["x-frame-options", String(h["x-frame-options"] ?? "").toUpperCase().includes("DENY")],
      ["referrer-policy", h["referrer-policy"] !== undefined],
    ];
    for (const [label, ok] of checks) {
      if (ok) pass(`header ${label}`);
      else fail(`header ${label} missing on /login`);
    }

    // A `wss://0.0.0.0` origin here is the bug this suite exists to catch: the
    // policy then refuses every real socket and realtime falls back to polling.
    const socketOrigin = /connect-src[^;]*wss?:\/\/([^;\s]+)/.exec(csp)?.[1] ?? "";
    if (socketOrigin === "") {
      pass("CSP carries no socket origin (same-origin only)");
    } else if (/^(0\.0\.0\.0|localhost|127\.0\.0\.1)(:\d+)?$/.test(socketOrigin) && !BASE_URL.includes(socketOrigin.split(":")[0])) {
      fail(`CSP pins the socket to a bind address (${socketOrigin}), not the public origin — realtime will be refused`);
    } else {
      pass(`CSP socket origin (${socketOrigin})`);
    }
  } catch (error) {
    fail(`header checks — ${error instanceof Error ? error.message : "unknown error"}`);
  }

  // --- Cold-load concurrency probe --------------------------------------
  // Every other check here is sequential, so each passes on a host that 500s
  // under load. That is how this went unnoticed: the app was "up" in every
  // smoke run while a real first page load failed.
  try {
    const page = await new Promise<string>((resolve, reject) => {
      const req = request(`${BASE_URL}/login`, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => (body += chunk));
        res.on("end", () => resolve(body));
      });
      req.on("error", reject);
      req.setTimeout(REQUEST_TIMEOUT_MS, () => {
        req.destroy();
        reject(new Error("timeout reading /login"));
      });
      req.end();
    });

    const chunks = [...page.matchAll(/\/_next\/static\/[^"'\\]+\.js/g)].map((m) => m[0]);
    const unique = [...new Set(chunks)].slice(0, PROBE_CONCURRENCY);

    if (unique.length < 4) {
      fail(`cold-load probe found only ${unique.length} chunks — the page markup changed and the probe is no longer testing anything`);
    } else {
      const started = Date.now();
      const results = await Promise.all(unique.map((path) => get(path).then((r) => r.status, () => 0)));
      const elapsed = Date.now() - started;
      const ok = results.filter((status) => status === 200).length;
      const serverErrors = results.filter((status) => status >= 500).length;

      if (serverErrors > 0) {
        fail(
          `cold load: ${ok}/${results.length} static chunks served in ${elapsed}ms, ` +
            `${serverErrors} returned 5xx — this is the shared-host concurrency ceiling, and a juror opening the app hits it`,
        );
      } else if (ok === results.length) {
        pass(`cold load: ${ok}/${results.length} concurrent chunks in ${elapsed}ms`);
      } else {
        fail(`cold load: ${ok}/${results.length} chunks served in ${elapsed}ms`);
      }
    }
  } catch (error) {
    fail(`cold-load probe — ${error instanceof Error ? error.message : "unknown error"}`);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error("Smoke test runner failed:", error);
  process.exit(1);
});