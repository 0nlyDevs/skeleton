/**
 * Upload content types.
 *
 * The `Content-Type` header is a *claim* by the client, not a fact. Trusting it
 * is how a `.php` or `.html` file with an `image/png` label lands in the upload
 * directory, and on shared hosting a writable directory served by the web server
 * is a remote-code-execution primitive.
 *
 * So: the declared type must be on the allowlist **and** the bytes must match the
 * signature for that type. A mismatch is rejected, never silently corrected.
 */

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/** Extension used when storing each allowed type. Never derived from input. */
const EXTENSION_BY_MIME: Record<AllowedMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export function isAllowedMimeType(value: string): value is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

export function extensionForMime(mime: AllowedMimeType): string {
  return EXTENSION_BY_MIME[mime];
}

function startsWithBytes(buffer: Uint8Array, signature: readonly number[]): boolean {
  if (buffer.length < signature.length) return false;
  return signature.every((byte, index) => buffer[index] === byte);
}

/**
 * Identify a buffer from its magic bytes, or return `undefined`.
 *
 * Deliberately small: it recognises exactly the four formats the allowlist
 * admits. Anything else is rejected by omission rather than by a blocklist.
 */
export function detectMimeType(buffer: Uint8Array): AllowedMimeType | undefined {
  // JPEG: FF D8 FF
  if (startsWithBytes(buffer, [0xff, 0xd8, 0xff])) return "image/jpeg";

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }

  // WEBP: "RIFF" ???? "WEBP"
  if (
    startsWithBytes(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    buffer.length >= 12 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  // PDF: "%PDF-"
  if (startsWithBytes(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";

  return undefined;
}
