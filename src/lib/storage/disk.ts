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

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { env } from "@/lib/env";

/** Filenames are `<uuid>.<ext>` — the only shape this module accepts. */
const SAFE_FILENAME = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.[a-z0-9]{2,5}$/;

export function isSafeFilename(filename: string): boolean {
  return SAFE_FILENAME.test(filename);
}

export function uploadRoot(): string {
  return path.resolve(env.UPLOAD_DIR);
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

/** Remove a file, tolerating an already-missing one. */
export async function removeUpload(filename: string): Promise<void> {
  try {
    await unlink(resolveUploadPath(filename));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
