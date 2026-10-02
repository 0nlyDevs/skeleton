/**
 * Mirror server logs into a file the hosting panel can show.
 *
 * On cPanel/Passenger (Hodifly) the process's stdout and stderr end up in the
 * Passenger log, which a team account cannot read. When the app crashes or
 * refuses to boot, that leaves nothing to debug from. This copies every
 * warning and error line (the logger writes those to stderr, Next does too)
 * plus the startup banner to `APP_LOG_FILE`, by default `~/logs/skeleton-app.log`,
 * readable from the File Manager. Node-only: imported by `server.ts` alone.
 */

import { createWriteStream, existsSync, mkdirSync, renameSync, statSync, type WriteStream } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { format } from "node:util";

const MAX_BYTES = 5 * 1024 * 1024;

export function installFileLog(): string | null {
  if (process.env.APP_LOG_FILE === "off") return null;
  const file = process.env.APP_LOG_FILE || path.join(homedir(), "logs", "skeleton-app.log");
  let stream: WriteStream;
  try {
    mkdirSync(path.dirname(file), { recursive: true });
    // One previous generation is kept; the file never grows without bound.
    if (existsSync(file) && statSync(file).size > MAX_BYTES) renameSync(file, `${file}.1`);
    stream = createWriteStream(file, { flags: "a" });
    stream.on("error", () => undefined);
  } catch {
    return null;
  }

  for (const method of ["error", "warn"] as const) {
    const original = console[method].bind(console);
    console[method] = (...args: unknown[]) => {
      original(...args);
      try {
        stream.write(`${format(...args)}\n`);
      } catch {
        // Logging must never take the server down.
      }
    };
  }

  stream.write(
    `${JSON.stringify({ level: "info", time: new Date().toISOString(), message: "process starting", pid: process.pid, node: process.version, cwd: process.cwd(), memoryMb: Math.round(process.memoryUsage().rss / 1048576) })}\n`,
  );
  return file;
}
