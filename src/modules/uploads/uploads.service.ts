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
  UnsupportedMediaTypeError,
} from "@/lib/errors";
import { isStaff } from "@/lib/auth/guards";
import { sanitizeImage } from "@/lib/storage/image";
import { detectMimeType, extensionForMime } from "@/lib/storage/mime";
import { readUpload, removeUpload, saveUpload } from "@/lib/storage/disk";
import type { AuthUser } from "@/types";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";
import { toUploadDto, type UploadDto } from "./uploads.dto";
import { loadReadablePost } from "../posts/posts.service";
import { isRoomMember } from "../messages/messages.repository";
import { createUpload, findUploadAttachment, findUploadById } from "./uploads.repository";

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

  const detected = detectMimeType(input.bytes);
  if (!detected) {
    throw new UnsupportedMediaTypeError("Only JPEG, PNG, WebP and PDF files are accepted.");
  }

  // Images are decoded and re-encoded (metadata stripped, size capped); what
  // is stored is our own WebP, never the bytes the client sent.
  const image = detected.startsWith("image/") ? await sanitizeImage(input.bytes) : null;
  const mime = image ? image.mime : detected;
  const bytes = image ? image.bytes : input.bytes;

  // The stored name is generated, never derived from user input: a filename is
  // attacker-controlled data and must not reach the filesystem.
  const filename = `${randomUUID()}.${extensionForMime(mime)}`;
  const originalName = input.filename.slice(0, ORIGINAL_NAME_MAX) || filename;

  await saveUpload(filename, bytes);

  try {
    const row = await createUpload({
      userId: actor.user.id,
      filename,
      originalName,
      mime,
      size: bytes.byteLength,
      visibility: input.visibility ?? "PRIVATE",
      width: image?.width ?? null,
      height: image?.height ?? null,
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

/**
 * A private upload is visible to its owner and staff — and, once attached, to
 * exactly the audience of what it is attached to: the readers of the post, or
 * the members of the conversation. Access follows the content, so moving a
 * post into a private group or leaving a chat revokes the image too.
 */
async function canViewPrivateUpload(
  row: { id: string; userId: string },
  viewer: AuthUser | null,
): Promise<boolean> {
  if (viewer && (row.userId === viewer.id || isStaff(viewer))) return true;

  const attachment = await findUploadAttachment(row.id);
  if (attachment?.postMedia) {
    try {
      const post = await loadReadablePost(attachment.postMedia.postId, viewer);
      return post.deletedAt === null;
    } catch {
      return false;
    }
  }
  if (attachment?.message && viewer && !attachment.message.deletedAt) {
    return isRoomMember(attachment.message.roomId, viewer.id);
  }
  return false;
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

  if (row.visibility === "PRIVATE" && !(await canViewPrivateUpload(row, viewer))) {
    // A private file's existence is not disclosed to strangers: 404, not 403.
    throw new NotFoundError();
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
