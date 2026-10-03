/**
 * Encryption at rest for private fields (messages, notification bodies,
 * birth dates).
 *
 * AES-256-GCM, a fresh 96-bit IV per value, and the authentication tag kept
 * with the ciphertext, so tampering is detected rather than decrypted into
 * garbage. The key is derived with HKDF from `DATA_ENCRYPTION_KEY` (or, when
 * that is not set, from `BETTER_AUTH_SECRET` with a distinct label, so the
 * two secrets are never the same key material).
 *
 * Format: `enc:v1:<iv>:<tag>:<ciphertext>` (base64url). The version prefix
 * lets the key or algorithm rotate later; values written before encryption
 * existed carry no prefix and are returned as-is, so the change needs no
 * downtime migration.
 *
 * Scope note: this protects a stolen database dump or backup. It is not
 * end-to-end encryption — the server can read messages, which moderation of
 * reported content requires.
 *
 * Failure is loud. A row that cannot be decrypted yields {@link UNREADABLE},
 * not an empty string: `""` is indistinguishable from a field that was
 * legitimately empty, so a rotated `DATA_ENCRYPTION_KEY` silently presented lost
 * data as absent data. The marker cannot be mistaken for content, and
 * `encryptField` refuses it so a failed read can never be written back over the
 * ciphertext it failed to open.
 */

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

import { FROZEN_IDENTIFIERS } from "@/lib/brand";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

const PREFIX = "enc:v1:";
const ALGORITHM = "aes-256-gcm";

/** Stand-in for a value that could not be decrypted. See the module note. */
export const UNREADABLE = "[unreadable: wrong or rotated DATA_ENCRYPTION_KEY]";

/** Rolling failure signal, surfaced by `/api/health` so this cannot go unnoticed. */
let failureCount = 0;
let lastFailureAt: number | null = null;

export interface EncryptionHealth {
  /** False as soon as one value has failed to decrypt in this process. */
  readonly healthy: boolean;
  readonly failures: number;
  readonly lastFailureAt: string | null;
  /** Key source, so a mismatch points at the variable to fix. */
  readonly keySource: "DATA_ENCRYPTION_KEY" | "BETTER_AUTH_SECRET";
}

export function encryptionHealth(): EncryptionHealth {
  return {
    healthy: failureCount === 0,
    failures: failureCount,
    lastFailureAt: lastFailureAt === null ? null : new Date(lastFailureAt).toISOString(),
    keySource: env.DATA_ENCRYPTION_KEY ? "DATA_ENCRYPTION_KEY" : "BETTER_AUTH_SECRET",
  };
}

let cachedKey: Buffer | undefined;

function key(): Buffer {
  if (cachedKey) return cachedKey;
  const dedicated = env.DATA_ENCRYPTION_KEY;
  const material = dedicated ?? env.BETTER_AUTH_SECRET;
  const derived = hkdfSync("sha256", material, FROZEN_IDENTIFIERS.ENCRYPTION_KEY_INFO,
    dedicated ? "data-key-v1" : "auth-derived-data-key-v1", 32);
  cachedKey = Buffer.from(derived);
  return cachedKey;
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encryptField(plaintext: string): string {
  if (plaintext === UNREADABLE) {
    // A read-modify-write would otherwise persist the marker as if it were the
    // user's real message, destroying data a later key fix could still recover.
    throw new Error("Refusing to encrypt the unreadable marker.");
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

/** Plaintext for an encrypted value; legacy plaintext passes through. */
export function decryptField(stored: string): string {
  if (!isEncrypted(stored)) return stored;
  try {
    const [iv, tag, data] = stored.slice(PREFIX.length).split(":");
    const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(iv ?? "", "base64url"));
    decipher.setAuthTag(Buffer.from(tag ?? "", "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data ?? "", "base64url")), decipher.final()]).toString("utf8");
  } catch (error) {
    // Wrong key or a tampered row: never surface ciphertext as content, and
    // never pretend the field was simply empty.
    failureCount += 1;
    lastFailureAt = Date.now();
    logger.error("field decryption failed — data encrypted under a different key is unrecoverable", {
      error,
      failureCount,
      keySource: env.DATA_ENCRYPTION_KEY ? "DATA_ENCRYPTION_KEY" : "BETTER_AUTH_SECRET",
    });
    return UNREADABLE;
  }
}

export function encryptNullable(value: string | null | undefined): string | null {
  return value === null || value === undefined || value === "" ? (value ?? null) : encryptField(value);
}

export function decryptNullable(value: string | null | undefined): string | null {
  return value === null || value === undefined ? null : decryptField(value);
}
