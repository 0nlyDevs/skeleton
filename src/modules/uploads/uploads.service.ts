/**
 * Upload business rules.
 *
 * Two invariants, both enforced here rather than in the route:
 *
 *   1. **The allowlist is decided by bytes, never by the client's header.**
 *      `detectMimeType` matches magic bytes against the four formats the app
 *      admits; a mismatch is a 415, never a silent rename.
 *   2. **The size cap is enforced before anything touches the disk.**
 *      `UPLOAD_MAX_BYTES` is checked against the in-memory buffer the route
 *      already had to read, so a rejected file leaves no trace at all.
 *
 * The row and the file are written in that order — disk first, then Prisma —
 * because an orphaned row would 404 forever, while an orphaned file is
 * invisible and harmless.
 */

import { randomUUID } from "node:crypto";

import { env } from "@/lib/env";
import {
  NotFoundError,
  PayloadTooLargeError,
  UnauthenticatedError,
  UnsupportedMediaTypeError,
} from "@/lib/errors";
import { isStaff } from "@/lib/auth/guards";
import { detectMimeType, extensionForMime } from "@/lib/storage/mime";
import { readUpload, removeUpload, saveUpload } from "@/lib/storage/disk";
import type { AuthUser } from "@/types";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";
import { toUploadDto, type UploadDto } from "./uploads.dto";
import { createUpload, findUploadById } from "./uploads.repository";

/** First 191 chars of a filename fit the `originalName` column comfortably. */
const ORIGINAL_NAME_MAX = 191;

export interface UploadFileInput {
  readonly filename: string;
  readonly bytes: Buffer;
  /** Defaults to PRIVATE at the schema level; the route passes the parsed value. */
  readonly visibility?: "PUBLIC" | "PRIVATE";
}

export interface ActorContext {
  readonly user: AuthUser;
  readonly ip?: string;
}

export async function uploadFileForActor(
  input: UploadFileInput,
  actor: ActorContext,
): Promise<UploadDto> {
  if (input.bytes.byteLength === 0) {
    throw new UnsupportedMediaTypeError("The uploaded file is empty.");
  }

  if (input.bytes.byteLength > env.UPLOAD_MAX_BYTES) {
    throw new PayloadTooLargeError(
      `The uploaded file exceeds the ${env.UPLOAD_MAX_BYTES} byte limit.`,
    );
  }

  const mime = detectMimeType(input.bytes);
  if (!mime) {
    throw new UnsupportedMediaTypeError("Only JPEG, PNG, WebP and PDF files are accepted.");
  }

  // The stored name is generated, never derived from user input: a filename is
  // attacker-controlled data and must not reach the filesystem.
  const filename = `${randomUUID()}.${extensionForMime(mime)}`;
  const originalName = input.filename.slice(0, ORIGINAL_NAME_MAX) || filename;

  await saveUpload(filename, input.bytes);

  try {
    const row = await createUpload({
      userId: actor.user.id,
      filename,
      originalName,
      mime,
      size: input.bytes.byteLength,
      visibility: input.visibility ?? "PRIVATE",
    });

    await recordAudit({
      actorId: actor.user.id,
      action: auditActions.uploadCreated,
      targetType: "upload",
      targetId: row.id,
      metadata: { mime, size: row.size },
      ip: actor.ip ?? null,
    });

    return toUploadDto(row);
  } catch (error) {
    // The row is the only thing that can fail after the write; remove the file
    // so a failed upload does not leak bytes on the disk forever.
    await removeUpload(filename).catch(() => undefined);
    throw error;
  }
}

export interface StoredFile {
  readonly bytes: Buffer;
  readonly mime: string;
  readonly visibility: "PUBLIC" | "PRIVATE";
}

/**
 * Load a file for delivery after re-checking authorization on this request —
 * the route is the only way in, so the visibility decision lives here too.
 */
export async function getFileForViewer(id: string, viewer: AuthUser | null): Promise<StoredFile> {
  const row = await findUploadById(id);
  if (!row) throw new NotFoundError();

  if (row.visibility === "PRIVATE") {
    if (!viewer) throw new UnauthenticatedError();
    if (row.userId !== viewer.id && !isStaff(viewer)) {
      // A private file's existence is not disclosed to strangers: 404, not 403.
      throw new NotFoundError();
    }
  }

  let bytes: Buffer;
  try {
    bytes = await readUpload(row.filename);
  } catch {
    // The row outlived the file (manual cleanup, failed write): treat as gone.
    throw new NotFoundError();
  }

  return { bytes, mime: row.mime, visibility: row.visibility };
}
