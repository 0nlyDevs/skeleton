/**
 * Audit service.
 *
 * `recordAudit` is the only way audit rows enter the system, and it is
 * deliberately **incapable of failing the caller**: if writing the trail fails,
 * the business operation must still succeed. Losing a log line is bad; losing a
 * user's data because the log table is locked is worse. Failures are logged at
 * `error` so they are visible in monitoring.
 */

import type { Prisma } from "@prisma/client";

import { logger } from "@/lib/logger";
import { paginate, resolveSortField, type Paginated } from "@/lib/pagination";
import { parseDateInput } from "@/lib/utils";

import { toAuditLogDto, type AuditLogDto } from "./audit.dto";
import {
  countAuditLogs,
  createAuditLog,
  findAuditLogs,
  findDistinctAuditActions,
} from "./audit.repository";
import type { ListAuditLogsQuery } from "./audit.schema";

export interface RecordAuditInput {
  readonly actorId?: string | null;
  readonly action: string;
  readonly targetType?: string | null;
  readonly targetId?: string | null;
  readonly metadata?: Record<string, unknown>;
  readonly ip?: string | null;
}

export async function recordAudit(input: RecordAuditInput): Promise<void> {
  try {
    await createAuditLog({
      userId: input.actorId ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      ip: input.ip ?? null,
    });
  } catch (error) {
    logger.error("failed to write audit log", {
      action: input.action,
      actorId: input.actorId,
      targetType: input.targetType,
      targetId: input.targetId,
      error,
    });
  }
}

function buildWhere(query: ListAuditLogsQuery): Prisma.AuditLogWhereInput {
  const from = parseDateInput(query.from);
  const to = parseDateInput(query.to);

  return {
    ...(query.action ? { action: { contains: query.action } } : {}),
    ...(query.userId ? { userId: query.userId } : {}),
    ...(query.targetType ? { targetType: query.targetType } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };
}

/**
 * Browse the trail.
 *
 * Route-level authorization (`roles: ADMIN_ROLES`) is the gate for this one:
 * there is no per-resource rule to apply, and duplicating the check here would
 * only create a second place for the two to drift apart.
 */
export async function listAuditLogs(
  query: ListAuditLogsQuery,
): Promise<Paginated<AuditLogDto>> {
  const where = buildWhere(query);
  const order = resolveSortField(query.order, ["asc", "desc"] as const, "desc");
  const { page, limit } = query;

  const [rows, total] = await Promise.all([
    findAuditLogs({ where, skip: (page - 1) * limit, take: limit, order }),
    countAuditLogs(where),
  ]);

  return paginate(rows.map(toAuditLogDto), { page, limit, total });
}

/** Action names present in the trail, for the admin filter dropdown. */
export async function listAuditActions(): Promise<string[]> {
  return findDistinctAuditActions();
}
