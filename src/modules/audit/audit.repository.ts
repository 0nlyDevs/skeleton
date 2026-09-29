/**
 * Audit log persistence.
 *
 * The table is append-only from the application's point of view: there is no
 * update and no delete-by-id here. Rows leave only through the retention cron,
 * which trims by age.
 */

import { type Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export const auditLogActorSelect = {
  user: { select: { id: true, name: true } },
} satisfies Prisma.AuditLogInclude;

export type AuditLogWithActor = Prisma.AuditLogGetPayload<{
  include: typeof auditLogActorSelect;
}>;

export interface AuditLogListArgs {
  readonly where: Prisma.AuditLogWhereInput;
  readonly skip: number;
  readonly take: number;
  readonly order: "asc" | "desc";
}

export async function createAuditLog(
  data: Prisma.AuditLogUncheckedCreateInput,
): Promise<void> {
  await prisma.auditLog.create({ data });
}

export async function findAuditLogs(args: AuditLogListArgs): Promise<AuditLogWithActor[]> {
  return prisma.auditLog.findMany({
    where: args.where,
    include: auditLogActorSelect,
    orderBy: { createdAt: args.order },
    skip: args.skip,
    take: args.take,
  });
}

export async function countAuditLogs(where: Prisma.AuditLogWhereInput): Promise<number> {
  return prisma.auditLog.count({ where });
}

/** Distinct action names, for the admin filter dropdown. */
export async function findDistinctAuditActions(): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({
    distinct: ["action"],
    select: { action: true },
    orderBy: { action: "asc" },
    take: 200,
  });
  return rows.map((row) => row.action);
}

/** Retention: drop rows older than the cutoff. Called from the cron endpoint. */
export async function deleteAuditLogsOlderThan(cutoff: Date): Promise<number> {
  const { count } = await prisma.auditLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return count;
}
