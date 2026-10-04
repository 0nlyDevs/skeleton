/**
 * F100 — the latest security events, for the agents' daily follow-up: failed
 * and locked sign-ins, changes of role, suspensions, changes to how an
 * account signs in, exports and backups. Read from the audit trail; the
 * address a sign-in came from is shortened, and no secret is ever stored.
 */

import { isStaff } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError } from "@/lib/errors";
import { blockedFormAttempts } from "@/lib/security/form-guard";
import type { AuthUser } from "@/types";

import { auditActions } from "../audit/audit.schema";

/** Needs a look today / worth knowing / routine. */
export type SecurityLevel = "alert" | "notice" | "routine";

const LEVELS: Readonly<Record<string, SecurityLevel>> = {
  [auditActions.signInLocked]: "alert",
  [auditActions.userRoleChanged]: "alert",
  [auditActions.userBanned]: "alert",
  [auditActions.userDeleted]: "alert",
  [auditActions.userTwoFactorDisabled]: "alert",
  [auditActions.signInFailed]: "notice",
  [auditActions.userUnbanned]: "notice",
  [auditActions.userPasswordChanged]: "notice",
  [auditActions.userSessionsRevoked]: "notice",
  [auditActions.passkeyRemoved]: "notice",
  [auditActions.deviceForgotten]: "notice",
  [auditActions.trackingExported]: "notice",
  [auditActions.dataExported]: "notice",
  [auditActions.userTwoFactorEnabled]: "routine",
  [auditActions.passkeyAdded]: "routine",
  [auditActions.deviceConfirmed]: "routine",
  [auditActions.backupVerified]: "routine",
};
export const SECURITY_ACTIONS = Object.keys(LEVELS);

export interface SecurityEventDto {
  readonly id: string;
  /** Translation key suffix: the action with dots as underscores. */
  readonly kind: string;
  readonly level: SecurityLevel;
  /** Who did it, when known. A failed sign-in has nobody. */
  readonly actor: string | null;
  /** Shortened network address, e.g. "203.0.x.x". */
  readonly origin: string | null;
  readonly createdAt: string;
}

export interface SecurityEventsDto {
  readonly checkedAt: string;
  readonly last24h: { readonly failedSignIns: number; readonly lockedSignIns: number; readonly sensitiveChanges: number; readonly blockedForms: number };
  /** Calm, watch, or act: one word for the day, from the counts above. */
  readonly mood: "calm" | "watch" | "act";
  readonly events: SecurityEventDto[];
}

function shortOrigin(ip: string | null): string | null {
  if (!ip) return null;
  if (ip.includes(".")) return `${ip.split(".").slice(0, 2).join(".")}.x.x`;
  return `${ip.split(":").slice(0, 2).join(":")}:…`;
}

export async function listSecurityEvents(actor: AuthUser, level?: SecurityLevel): Promise<SecurityEventsDto> {
  if (!isStaff(actor)) throw new ForbiddenError("Only city staff can read security events.");
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60_000);
  const actions = level ? SECURITY_ACTIONS.filter((action) => LEVELS[action] === level) : SECURITY_ACTIONS;
  const sensitive = SECURITY_ACTIONS.filter((action) => LEVELS[action] === "alert" && action !== auditActions.signInLocked);
  const [rows, failed, locked, changes] = await Promise.all([
    prisma.auditLog.findMany({ where: { action: { in: actions } }, orderBy: { createdAt: "desc" }, take: 60, select: { id: true, action: true, ip: true, createdAt: true, user: { select: { name: true } } } }),
    prisma.auditLog.count({ where: { action: auditActions.signInFailed, createdAt: { gte: since } } }),
    prisma.auditLog.count({ where: { action: auditActions.signInLocked, createdAt: { gte: since } } }),
    prisma.auditLog.count({ where: { action: { in: sensitive }, createdAt: { gte: since } } }),
  ]);
  const blockedForms = blockedFormAttempts().total;
  const mood = locked > 0 || failed >= 20 ? "act" : failed >= 5 || changes > 0 || blockedForms >= 5 ? "watch" : "calm";
  return {
    checkedAt: now.toISOString(),
    last24h: { failedSignIns: failed, lockedSignIns: locked, sensitiveChanges: changes, blockedForms },
    mood,
    events: rows.map((row) => ({
      id: row.id,
      kind: row.action.replace(/\./g, "_"),
      level: LEVELS[row.action] ?? "routine",
      actor: row.user?.name ?? null,
      origin: shortOrigin(row.ip),
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
