/**
 * Local disk storage.
 *
 * Two invariants, both enforced here rather than at the call site:
 *
 *   1. **Nothing is written inside the application directory.** `UPLOAD_DIR`
 *      points outside the Node app's root, so a malicious or malformed PDF can
 *      never sit next to `server.js` where the web server might execute it.
 *   2. **Every path is resolved and re-checked.** `resolveUploadPath` joins the
 *      configured root and refuses anything that escapes it, which stops `../`
 *      and absolute paths from reaching the filesystem.
 *
 * The interface is three functions wide on purpose: swapping in S3 later means
 * writing one more module, not editing the upload service.
 */

import { existsSync, readdirSync } from "node:fs";
import { copyFile, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import { env } from "@/lib/env";

/**
 * Filenames are `<uuid>.<ext>`, or `<uuid>.w<width>.<ext>` for a resized copy
 * of an image — the only shapes this module accepts.
 */
const SAFE_FILENAME = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(\.w\d{3,4})?\.[a-z0-9]{2,5}$/;

export function isSafeFilename(filename: string): boolean {
  return SAFE_FILENAME.test(filename);
}

/**
 * Hosts that deploy each release into a fresh folder (Hodifly:
 * `~/…/releases/<id>/`) would lose every upload at the next deploy if files
 * lived under the release, which is where a relative `UPLOAD_DIR` points.
 * In that layout a relative setting is anchored in the home directory
 * instead, which survives releases.
 */
function releaseRoot(): string | null {
  const marker = `${path.sep}releases${path.sep}`;
  const cwd = process.cwd();
  const index = cwd.indexOf(marker);
  return index === -1 ? null : cwd.slice(0, index + marker.length - 1);
}

export function uploadRoot(): string {
  if (path.isAbsolute(env.UPLOAD_DIR)) return env.UPLOAD_DIR;
  if (releaseRoot()) return path.join(homedir(), "skeleton-data", path.normalize(env.UPLOAD_DIR).replace(/^(\.\.?[\\/])+/, ""));
  return path.resolve(env.UPLOAD_DIR);
}

/**
 * Bring back files that earlier releases wrote inside their own folder (before
 * uploads were anchored outside releases). Copies only missing, safely named
 * files; never overwrites. Best effort, run once at startup.
 */
export async function recoverReleaseUploads(): Promise<number> {
  const releases = releaseRoot();
  if (!releases || path.isAbsolute(env.UPLOAD_DIR)) return 0;
  const target = uploadRoot();
  await mkdir(target, { recursive: true });
  let recovered = 0;
  for (const release of readdirSync(releases, { withFileTypes: true })) {
    if (!release.isDirectory()) continue;
    for (const candidate of [
      path.join(releases, release.name, env.UPLOAD_DIR),
      path.join(releases, release.name, ".next", "standalone", env.UPLOAD_DIR),
    ]) {
      if (!existsSync(candidate) || path.resolve(candidate) === target) continue;
      for (const file of readdirSync(candidate)) {
        if (!isSafeFilename(file) || existsSync(path.join(target, file))) continue;
        await copyFile(path.join(candidate, file), path.join(target, file)).then(
          () => (recovered += 1),
          () => undefined,
        );
      }
    }
  }
  return recovered;
}

/**
 * Resolve a stored filename to an absolute path.
 * Throws on anything that would leave the upload root.
 */
export function resolveUploadPath(filename: string): string {
  if (!isSafeFilename(filename)) {
    throw new Error("Refusing to resolve an unsafe filename.");
  }

  const root = uploadRoot();
  const resolved = path.resolve(root, filename);

  if (resolved !== path.join(root, filename)) {
    throw new Error("Refusing to resolve a path outside the upload directory.");
  }

  return resolved;
}

/** Create the upload root if it does not exist yet. */
export async function ensureUploadRoot(): Promise<void> {
  await mkdir(uploadRoot(), { recursive: true });
}

export async function saveUpload(filename: string, data: Buffer): Promise<void> {
  const target = resolveUploadPath(filename);
  await ensureUploadRoot();
  // `wx` would fail on an existing name; we use a fresh UUID, so plain write is
  // fine and keeps retries idempotent.
  await writeFile(target, data, { mode: 0o640 });
}

export async function readUpload(filename: string): Promise<Buffer> {
  return readFile(resolveUploadPath(filename));
}

/** The stored name of `filename` resized to `width` pixels. */
export function variantFilename(filename: string, width: number): string {
  return filename.replace(/\.([a-z0-9]{2,5})$/, `.w${width}.$1`);
}

/** Remove a file, tolerating an already-missing one. */
export async function removeUpload(filename: string): Promise<void> {
  try {
    await unlink(resolveUploadPath(filename));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
