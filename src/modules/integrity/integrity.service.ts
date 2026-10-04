/**
 * F85 — when activity looks unusual, administrators need facts: is the data
 * still coherent, and what happened lately? This runs a fixed set of checks
 * on the important records and returns each as one plain sentence with a
 * count, plus the recent signals (failed sign-ins, forms blocked as robots).
 */

import { isAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError } from "@/lib/errors";
import { blockedFormAttempts } from "@/lib/security/form-guard";
import type { AuthUser } from "@/types";

import { auditActions } from "../audit/audit.schema";

export interface IntegrityCheckDto {
  /** Translation key suffix: `tn.integrity.check.<id>`. */
  readonly id: string;
  readonly ok: boolean;
  /** Records that break the rule. */
  readonly count: number;
}

export interface IntegrityReportDto {
  readonly checkedAt: string;
  readonly ok: boolean;
  readonly checks: IntegrityCheckDto[];
  readonly signals: {
    readonly failedSignIns24h: number;
    readonly lockedSignIns24h: number;
    readonly blockedForms24h: number;
    readonly roleChanges24h: number;
  };
}

export async function runIntegrityReport(actor: AuthUser): Promise<IntegrityReportDto> {
  if (!isAdmin(actor)) throw new ForbiddenError("Only administrators can run the data check.");
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60_000);
  const [closedWithoutDate, openWithCloseDate, assignedToResident, movedWithoutAgent, ratingOutOfRange, appointmentLeftOpen, suspendedStaff, answeredWithoutReply, failed, locked, roles] =
    await Promise.all([
      prisma.cityRequest.count({ where: { status: { in: ["RESOLVED", "CLOSED"] }, closedAt: null } }),
      prisma.cityRequest.count({ where: { status: { in: ["NEW", "IN_PROGRESS", "WAITING_CITIZEN"] }, closedAt: { not: null } } }),
      prisma.cityRequest.count({ where: { assignee: { role: "USER" } } }),
      prisma.cityRequest.count({ where: { status: { in: ["IN_PROGRESS", "WAITING_CITIZEN"] }, assigneeId: null } }),
      prisma.serviceFeedback.count({ where: { OR: [{ rating: { lt: 1 } }, { rating: { gt: 5 } }] } }),
      prisma.appointment.count({ where: { status: "BOOKED", endsAt: { lt: since } } }),
      prisma.user.count({ where: { role: { in: ["AGENT", "ADMIN"] }, banned: true } }),
      prisma.serviceFeedback.count({ where: { status: "ANSWERED", reply: null } }),
      prisma.auditLog.count({ where: { action: auditActions.signInFailed, createdAt: { gte: since } } }),
      prisma.auditLog.count({ where: { action: auditActions.signInLocked, createdAt: { gte: since } } }),
      prisma.auditLog.count({ where: { action: auditActions.userRoleChanged, createdAt: { gte: since } } }),
    ]);
  const checks: IntegrityCheckDto[] = [
    { id: "closed_without_date", count: closedWithoutDate },
    { id: "open_with_close_date", count: openWithCloseDate },
    { id: "assigned_to_resident", count: assignedToResident },
    { id: "moved_without_agent", count: movedWithoutAgent },
    { id: "rating_out_of_range", count: ratingOutOfRange },
    { id: "appointment_left_open", count: appointmentLeftOpen },
    { id: "suspended_staff", count: suspendedStaff },
    { id: "answered_without_reply", count: answeredWithoutReply },
  ].map((check) => ({ ...check, ok: check.count === 0 }));
  return {
    checkedAt: now.toISOString(),
    ok: checks.every((check) => check.ok),
    checks,
    signals: { failedSignIns24h: failed, lockedSignIns24h: locked, blockedForms24h: blockedFormAttempts().total, roleChanges24h: roles },
  };
}
