/**
 * Read side of sign-in protection, built on the audit trail written by
 * `recordFailedSignIn`: what an account owner sees about their own account,
 * and the cross-account picture administrators need to spot a wave.
 */

import { isIP } from "node:net";

import { prisma } from "@/lib/db/prisma";

import { auditActions } from "../audit/audit.schema";

const HOUR_MS = 60 * 60 * 1000;
/** Bounds the hourly chart query even under a large attack. */
const SERIES_ROW_CAP = 5000;

/**
 * Thresholds over the last hour. "Attack" is several accounts failing at once
 * — the shape of credential stuffing — rather than one resident's typos.
 */
export const WAVE_THRESHOLDS = { elevatedFailures: 8, attackAccounts: 5, attackFailures: 15 } as const;

export type ProtectionStatus = "NORMAL" | "ELEVATED" | "ATTACK";

/** Keep enough of an address to recognise a source, not to locate a person. */
export function maskIp(ip: string | null): string {
  if (!ip) return "-";
  if (isIP(ip) === 4) return `${ip.split(".").slice(0, 3).join(".")}.x`;
  if (isIP(ip) === 6) return `${ip.split(":").filter(Boolean).slice(0, 3).join(":")}::x`;
  return "-";
}

function readFlag(metadata: unknown, key: string): boolean {
  return typeof metadata === "object" && metadata !== null && (metadata as Record<string, unknown>)[key] === true;
}

export interface FailedSignInDto {
  readonly id: string;
  readonly at: string;
  readonly ip: string;
  readonly locked: boolean;
}

/** The owner's recent failed attempts (last 30 days, newest first). */
export async function listMyFailedSignIns(userId: string, limit = 8): Promise<{ total: number; items: FailedSignInDto[] }> {
  const where = {
    action: auditActions.signInFailed,
    targetType: "user",
    targetId: userId,
    createdAt: { gte: new Date(Date.now() - 30 * 24 * HOUR_MS) },
  };
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, select: { id: true, createdAt: true, ip: true, metadata: true } }),
  ]);
  return {
    total,
    items: rows.map((row) => ({ id: row.id, at: row.createdAt.toISOString(), ip: maskIp(row.ip), locked: readFlag(row.metadata, "locked") })),
  };
}

export interface LoginProtectionOverview {
  readonly status: ProtectionStatus;
  readonly lastHour: { readonly failures: number; readonly accounts: number; readonly sources: number };
  readonly last24h: { readonly failures: number; readonly locks: number; readonly accounts: number };
  /** Failures per hour, oldest first, 24 entries. */
  readonly hourly: readonly number[];
  readonly sources: readonly { readonly ip: string; readonly failures: number; readonly accounts: number }[];
  readonly recent: readonly {
    readonly id: string;
    readonly at: string;
    readonly ip: string;
    readonly locked: boolean;
    /** Null when the identifier matches no account. */
    readonly account: { readonly name: string; readonly username: string | null } | null;
  }[];
}

export function protectionStatus(lastHour: { failures: number; accounts: number }): ProtectionStatus {
  if (lastHour.accounts >= WAVE_THRESHOLDS.attackAccounts && lastHour.failures >= WAVE_THRESHOLDS.attackFailures) return "ATTACK";
  if (lastHour.failures >= WAVE_THRESHOLDS.elevatedFailures) return "ELEVATED";
  return "NORMAL";
}

export async function getLoginProtectionOverview(now: Date = new Date()): Promise<LoginProtectionOverview> {
  const hourAgo = new Date(now.getTime() - HOUR_MS);
  const dayAgo = new Date(now.getTime() - 24 * HOUR_MS);
  const failed = { action: auditActions.signInFailed };

  const [hourAccounts, hourSources, hourFailures, dayFailures, dayLocks, dayAccounts, series, bySource, recent] = await Promise.all([
    prisma.auditLog.groupBy({ by: ["targetId"], where: { ...failed, createdAt: { gte: hourAgo } } }),
    prisma.auditLog.groupBy({ by: ["ip"], where: { ...failed, createdAt: { gte: hourAgo } } }),
    prisma.auditLog.count({ where: { ...failed, createdAt: { gte: hourAgo } } }),
    prisma.auditLog.count({ where: { ...failed, createdAt: { gte: dayAgo } } }),
    prisma.auditLog.count({ where: { action: auditActions.signInLocked, createdAt: { gte: dayAgo } } }),
    prisma.auditLog.groupBy({ by: ["targetId"], where: { ...failed, createdAt: { gte: dayAgo } } }),
    prisma.auditLog.findMany({ where: { ...failed, createdAt: { gte: dayAgo } }, select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: SERIES_ROW_CAP }),
    prisma.auditLog.groupBy({ by: ["ip"], where: { ...failed, createdAt: { gte: dayAgo } }, _count: { _all: true }, orderBy: { _count: { ip: "desc" } }, take: 5 }),
    prisma.auditLog.findMany({ where: { ...failed }, orderBy: { createdAt: "desc" }, take: 15, select: { id: true, createdAt: true, ip: true, metadata: true, targetType: true, targetId: true } }),
  ]);

  const hourly = Array.from({ length: 24 }, () => 0);
  for (const row of series) {
    const bucket = 23 - Math.floor((now.getTime() - row.createdAt.getTime()) / HOUR_MS);
    if (bucket >= 0 && bucket < 24) hourly[bucket] = (hourly[bucket] ?? 0) + 1;
  }

  const sourceIps = bySource.map((row) => row.ip).filter((ip): ip is string => ip !== null);
  const sourceAccounts = sourceIps.length
    ? await prisma.auditLog.groupBy({ by: ["ip", "targetId"], where: { ...failed, createdAt: { gte: dayAgo }, ip: { in: sourceIps } } })
    : [];

  const userIds = recent.filter((row) => row.targetType === "user" && row.targetId).map((row) => row.targetId as string);
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: [...new Set(userIds)] } }, select: { id: true, name: true, username: true } })
    : [];
  const userById = new Map(users.map((user) => [user.id, user]));

  const lastHour = { failures: hourFailures, accounts: hourAccounts.length, sources: hourSources.length };
  return {
    status: protectionStatus(lastHour),
    lastHour,
    last24h: { failures: dayFailures, locks: dayLocks, accounts: dayAccounts.length },
    hourly,
    sources: bySource.map((row) => ({
      ip: maskIp(row.ip),
      failures: row._count._all,
      accounts: sourceAccounts.filter((entry) => entry.ip === row.ip).length,
    })),
    recent: recent.map((row) => {
      const user = row.targetType === "user" && row.targetId ? userById.get(row.targetId) : undefined;
      return {
        id: row.id,
        at: row.createdAt.toISOString(),
        ip: maskIp(row.ip),
        locked: readFlag(row.metadata, "locked"),
        account: user ? { name: user.name, username: user.username } : null,
      };
    }),
  };
}
