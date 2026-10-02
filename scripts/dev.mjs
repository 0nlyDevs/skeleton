#!/usr/bin/env node
/**
 * Development launcher: `npm run dev`.
 *
 * Next.js needs a custom server to host the Socket.IO endpoint, and that server
 * cannot run through tsx (see `scripts/esbuild-server.mjs`). So the entry point
 * is bundled with esbuild and executed by plain `node`.
 *
 * Restart policy — the part that keeps this pleasant to work with:
 *
 *   * Only changes to files that were actually **inlined into the server
 *     bundle** trigger a restart. esbuild's metafile is the source of truth, so
 *     editing a page or a component does *not* bounce the process; Next's own
 *     HMR handles those.
 *   * Changes to Socket.IO handlers (`src/lib/socket/**`) *do* restart, which is
 *     what you want: the old handler closures are gone from memory.
 *   * Rebuilds are debounced, and the child is killed with SIGTERM so it can
 *     close listeners and the database pool before exiting.
 */

import { buildServer } from "./esbuild-server.mjs";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEBOUNCE_MS = 150;

let child = null;
let restarting = false;
let pending = false;
let timer = null;
let shuttingDown = false;

/**
 * Files esbuild inlined into the bundle, as absolute paths.
 *
 * Node builtins and the `external` modules have no metafile inputs, so anything
 * under node_modules is filtered out — watching those would restart the server
 * on every dependency install.
 */
function collectInputs(metafile) {
  const inputs = new Set();

  for (const output of Object.values(metafile.outputs)) {
    for (const input of Object.keys(output.inputs ?? {})) {
      if (input.includes("node_modules")) continue;
      inputs.add(path.resolve(ROOT, input));
    }
  }

  return [...inputs];
}

function startChild(outfile) {
  child = spawn(process.execPath, [outfile], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV ?? "development" },
  });

  child.on("exit", (code, signal) => {
    child = null;

    // Unexpected death should not silently leave the developer with a dead
    // terminal; the watcher stays alive so the next edit restarts the server.
    if (!shuttingDown && !restarting) {
      console.error(`[webcup] server exited (${signal ?? code}). Waiting for changes…`);
    }
  });
}

async function stopChild() {
  if (!child) return;

  const dying = child;
  child = null;

  await new Promise((resolve) => {
    const timeout = setTimeout(() => dying.kill("SIGKILL"), 5_000);
    dying.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    dying.kill("SIGTERM");
  });
}

async function restart(outfile) {
  if (restarting) {
    pending = true;
    return;
  }

  restarting = true;
  await stopChild();
  console.log("[webcup] restarting server…");
  startChild(outfile);
  restarting = false;

  if (pending) {
    pending = false;
    await restart(outfile);
  }
}

async function main() {
  const outfile = path.resolve(ROOT, ".dev/server.cjs");

  const { metafile } = await buildServer({ dev: true, outfile, metafile: true });

  const watched = new Set();

  const onChange = () => {
    if (shuttingDown) return;

    clearTimeout(timer);
    timer = setTimeout(() => {
      void (async () => {
        try {
          const rebuilt = await buildServer({ dev: true, outfile, metafile: true });
          // A file imported for the first time since startup joins the watch set.
          watch(collectInputs(rebuilt.metafile));
          await restart(outfile);
        } catch (error) {
          console.error("[webcup] rebuild failed:", error.message);
        }
      })();
    }, DEBOUNCE_MS);
  };

  const watch = (inputs) => {
    for (const input of inputs) {
      if (watched.has(input)) continue;
      watched.add(input);
      // `fs.watch` on a single file is cheapest and works on every platform; the
      // debounce absorbs editors that write twice per save.
      const watcher = fs.watch(input, { persistent: true }, (eventType) => {
        if (eventType === "rename") {
          // `git checkout`, `git stash` and many editors replace the file
          // instead of writing to it: the old watch is now on a dead inode.
          // Watch the new file once it is in place.
          watcher.close();
          watched.delete(input);
          setTimeout(() => {
            if (fs.existsSync(input)) watch([input]);
          }, 50);
        }
        onChange();
      });
      watcher.unref?.();
      watcher.on("error", () => {
        // A deleted file must not crash the launcher.
        watcher.close();
        watched.delete(input);
      });
    }
  };

  watch(collectInputs(metafile));
  console.log(`[webcup] watching ${watched.size} server file(s)`);

  startChild(outfile);

  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await stopChild();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((error) => {
  console.error("[webcup] failed to start the dev server:", error);
  process.exit(1);
});
