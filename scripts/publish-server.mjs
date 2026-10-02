/**
 * Copies the freshly bundled `server.cjs` into the Next standalone output.
 *
 * Hodifly publishes `.next/standalone` and starts `server.cjs` from inside it.
 * The only reason a `server.cjs` ever lands there today is Turbopack's
 * whole-project file trace (triggered by the dynamic `process.cwd()` path in
 * `src/lib/mail/mailer.ts`), and that trace runs during `next build` - i.e.
 * *before* `build:server` regenerates the bundle, so the copy it makes is one
 * deploy stale. This script makes the copy explicit and fresh.
 *
 * Locally the project builds without `output: "standalone"` (only Hodifly's
 * config wrapper forces it), so the directory does not exist and this is a
 * no-op.
 */
import { copyFileSync, existsSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "server.cjs");
const TARGET_DIR = path.join(ROOT, ".next", "standalone");
const TARGET = path.join(TARGET_DIR, "server.cjs");

if (!existsSync(TARGET_DIR)) {
  console.log("[webcup] no .next/standalone output (local build) - skipping server.cjs publish copy");
  process.exit(0);
}

if (!existsSync(SOURCE)) {
  console.error(`[webcup] ${path.relative(ROOT, SOURCE)} missing - run the build:server step first`);
  process.exit(1);
}

copyFileSync(SOURCE, TARGET);
console.log("[webcup] published server.cjs -> .next/standalone/server.cjs");

/*
 * Keep the deployed bundle small. The 24H by Webcup host gives a team 300 MB
 * of disk, and the forced runtime closure above (next/**) pushes the
 * standalone output past it. None of these files is read by a production
 * server: source maps, Next's bundled docs, and the dev-only runtimes (a
 * production server loads `*.runtime.prod.js`).
 */
let freed = 0;
function prune(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full.endsWith(path.join("next", "dist", "docs"))) {
        freed += sizeOf(full);
        rmSync(full, { recursive: true, force: true });
      } else {
        prune(full);
      }
    } else if (entry.name.endsWith(".map") || entry.name.endsWith(".runtime.dev.js")) {
      freed += statSync(full).size;
      rmSync(full, { force: true });
    }
  }
}
function sizeOf(target) {
  const stats = statSync(target);
  if (!stats.isDirectory()) return stats.size;
  return readdirSync(target).reduce((total, name) => total + sizeOf(path.join(target, name)), 0);
}
prune(TARGET_DIR);
console.log(`[webcup] pruned ${(freed / 1048576).toFixed(1)} MB of maps, docs and dev runtimes from .next/standalone`);

