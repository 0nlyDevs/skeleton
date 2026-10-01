/**
 * Bundles `server.ts` into a single CommonJS file that plain `node` can run.
 *
 * Why a bundle instead of running the TypeScript entry directly:
 *
 *   1. **tsx/ts-node break Next 15+.** Their CJS transform rewrites Next's
 *      internal module resolution, and the request handler then throws
 *      `Invariant: AsyncLocalStorage accessed in runtime where it is not
 *      available`. esbuild's output is plain CJS, so Next sees the same module
 *      graph it would under `next dev`.
 *   2. **One artefact for dev and prod.** The same bundler produces the file PM2
 *      runs, so "works on my machine" and production differ only in NODE_ENV.
 *
 * `.env` is loaded by the bundle's banner. Imports are hoisted, so a loader
 * inside `server.ts` would run *after* the modules that read `process.env` —
 * the banner runs before any of them.
 */

import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Modules that must be resolved at runtime, never inlined into the bundle. */
const EXTERNAL = [
  // Next compiles its own server runtime and must own its module graph.
  "next",
  // Native binaries: bundling them breaks the dynamic `.node` lookup.
  "@node-rs/argon2",
  "sharp",
  // Prisma 7's client is generated into `src/` and is bundled like any other
  // application code, but the MariaDB driver underneath opens sockets and uses
  // runtime `require`, so it stays a real dependency.
  "@prisma/adapter-mariadb",
  "@prisma/client-runtime-utils",
  "mariadb",
];

/**
 * @param {object} options
 * @param {boolean} [options.dev] Development build: keep readable output and
 *   default NODE_ENV to "development".
 * @param {string} [options.outfile] Output path, relative to the project root.
 * @param {boolean} [options.metafile] Return esbuild's metafile so the dev
 *   watcher knows exactly which files to watch.
 */
export async function buildServer({ dev = false, outfile, metafile = false } = {}) {
  const target = path.resolve(ROOT, outfile ?? (dev ? ".dev/server.cjs" : "server.cjs"));

  const banner = [
    // Loads .env before any bundled module reads process.env.
    // Optional on purpose: on Hodifly the release has no .env file (the
    // platform injects the variables directly) and no `dotenv` inside the
    // traced standalone node_modules, so a bare require would crash the
    // worker before the banner's second line ever runs.
    "try{require('dotenv').config({ quiet: true });}catch{}",
    // Next reads `globalThis.AsyncLocalStorage` rather than importing it, and
    // only its own CLI installs it. Without this the request handler throws
    // "Invariant: AsyncLocalStorage accessed in runtime where it is not
    // available" on the first render.
    "const { AsyncLocalStorage } = require('node:async_hooks');",
    "if (!globalThis.AsyncLocalStorage) globalThis.AsyncLocalStorage = AsyncLocalStorage;",
    // `npm start` does not export NODE_ENV, and Next decides between the dev
    // server and the built one from it — so it must never be left undefined.
    `process.env.NODE_ENV = process.env.NODE_ENV || '${dev ? "development" : "production"}';`,
  ].join("");

  const result = await build({
    entryPoints: [path.resolve(ROOT, "server.ts")],
    outfile: target,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    external: EXTERNAL,
    banner: { js: banner },
    alias: {
      "@": path.resolve(ROOT, "src"),
      "@emails": path.resolve(ROOT, "emails"),
    },
    // Prisma ships `.node` binaries; copy them rather than trying to parse them.
    loader: { ".node": "file" },
    // JSX lives in the email templates, which this entry transitively imports.
    jsx: "automatic",
    minify: !dev,
    sourcemap: dev ? "inline" : false,
    logLevel: "warning",
    ...(metafile ? { metafile: true } : {}),
  });

  return { outfile: target, metafile: result.metafile };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await buildServer({ dev: false, outfile: "server.cjs" });
  console.log(`[webcup] bundled ${path.relative(ROOT, result.outfile)}`);
}
