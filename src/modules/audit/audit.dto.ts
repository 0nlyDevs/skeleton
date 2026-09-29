/**
 * Audit log response shape.
 *
 * The metadata blob is scrubbed on the way out as well as on the way in: audit
 * rows are rendered in the admin UI and can be filtered by a jury account, so
 * anything sensitive that slipped into a metadata object must not be echoed
 * back.
 */

import type { AuditLog } from "@prisma/client";

const SENSITIVE_KEY = /pass(word)?|secret|token|authorization|cookie|api[-_]?key/i;

export interface AuditLogDto {
  readonly id: string;
  readonly action: string;
  readonly actor: { readonly id: string; readonly name: string } | null;
  readonly targetType: string | null;
  readonly targetId: string | null;
  readonly metadata: Record<string, unknown> | null;
  readonly ip: string | null;
  readonly createdAt: string;
}

const MAX_METADATA_DEPTH = 3;

function scrub(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== "object" || depth >= MAX_METADATA_DEPTH) return value;
  if (Array.isArray(value)) return value.map((entry) => scrub(entry, depth + 1));

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    output[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : scrub(entry, depth + 1);
  }
  return output;
}

export type AuditLogRow = AuditLog & { user: { id: string; name: string } | null };

export function toAuditLogDto(row: AuditLogRow): AuditLogDto {
  return {
    id: row.id,
    action: row.action,
    actor: row.user ? { id: row.user.id, name: row.user.name } : null,
    targetType: row.targetType,
    targetId: row.targetId,
    metadata: row.metadata === null ? null : (scrub(row.metadata) as Record<string, unknown>),
    ip: row.ip,
    createdAt: row.createdAt.toISOString(),
  };
}
