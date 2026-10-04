/**
 * F103 — the platform's activity over a period, as a short report managers
 * can read, print or download: what came in, what was handled and how fast,
 * what residents used and thought, and what needs attention. Counts only;
 * no name and no message leaves the platform.
 */

import { isStaff } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError } from "@/lib/errors";
import type { AuthUser } from "@/types";

import { auditActions } from "../audit/audit.schema";
import { getServiceUsage } from "./service-usage";

export interface ActivityReportDto {
  readonly days: number;
  readonly from: string;
  readonly to: string;
  readonly requests: { readonly received: number; readonly previous: number; readonly closed: number; readonly openNow: number; readonly withoutAgent: number; readonly urgentOpen: number; readonly hoursToClose: number | null };
  readonly appointments: { readonly booked: number; readonly asked: number };
  readonly opinions: { readonly count: number; readonly average: number | null; readonly unanswered: number };
  readonly city: { readonly alerts: number; readonly announcements: number; readonly newAccounts: number; readonly posts: number };
  readonly security: { readonly failedSignIns: number; readonly lockedSignIns: number };
  readonly topServices: ReadonlyArray<{ readonly name: string; readonly total: number; readonly share: number }>;
  /** What to act on, most pressing first; each is a translation key suffix with its numbers. */
  readonly attention: ReadonlyArray<{ readonly kind: "without_agent" | "urgent" | "slower" | "more_requests" | "low_rating" | "unanswered" | "locked"; readonly value: number }>;
}

export async function getActivityReport(actor: AuthUser, days = 30): Promise<ActivityReportDto> {
  if (!isStaff(actor)) throw new ForbiddenError("Only city staff can read the activity report.");
  const now = new Date();
  const span = days * 24 * 60 * 60_000;
  const from = new Date(now.getTime() - span);
  const range = { gte: from, lt: now };
  const open = { in: ["NEW", "IN_PROGRESS", "WAITING_CITIZEN"] as ("NEW" | "IN_PROGRESS" | "WAITING_CITIZEN")[] };
  const [received, previous, closedRows, openNow, withoutAgent, urgentOpen, booked, asked, opinions, unanswered, alerts, announcements, newAccounts, posts, failed, locked, usage] = await Promise.all([
    prisma.cityRequest.count({ where: { createdAt: range } }),
    prisma.cityRequest.count({ where: { createdAt: { gte: new Date(from.getTime() - span), lt: from } } }),
    prisma.cityRequest.findMany({ where: { closedAt: range }, select: { createdAt: true, closedAt: true }, take: 5_000 }),
    prisma.cityRequest.count({ where: { status: open } }),
    prisma.cityRequest.count({ where: { status: open, assigneeId: null } }),
    prisma.cityRequest.count({ where: { status: open, priority: "URGENT" } }),
    prisma.appointment.count({ where: { createdAt: range } }),
    prisma.appointmentRequest.count({ where: { createdAt: range } }),
    prisma.serviceFeedback.aggregate({ where: { createdAt: range }, _count: { _all: true }, _avg: { rating: true } }),
    prisma.serviceFeedback.count({ where: { status: { not: "ANSWERED" } } }),
    prisma.announcement.count({ where: { category: "ALERT", publishedAt: range } }),
    prisma.announcement.count({ where: { category: { not: "ALERT" }, publishedAt: range } }),
    prisma.user.count({ where: { createdAt: range } }),
    prisma.post.count({ where: { createdAt: range, published: true, deletedAt: null } }),
    prisma.auditLog.count({ where: { action: auditActions.signInFailed, createdAt: range } }),
    prisma.auditLog.count({ where: { action: auditActions.signInLocked, createdAt: range } }),
    getServiceUsage(actor, days),
  ]);
  const hours = closedRows.map((row) => ((row.closedAt?.getTime() ?? row.createdAt.getTime()) - row.createdAt.getTime()) / 3_600_000);
  const hoursToClose = hours.length > 0 ? Math.round((hours.reduce((sum, value) => sum + value, 0) / hours.length) * 10) / 10 : null;
  const average = opinions._avg.rating === null ? null : Math.round(opinions._avg.rating * 10) / 10;

  const attention: { kind: ActivityReportDto["attention"][number]["kind"]; value: number }[] = [];
  if (urgentOpen > 0) attention.push({ kind: "urgent", value: urgentOpen });
  if (withoutAgent > 0) attention.push({ kind: "without_agent", value: withoutAgent });
  if (hoursToClose !== null && hoursToClose > 72) attention.push({ kind: "slower", value: Math.round(hoursToClose / 24) });
  if (previous > 0 && received > previous * 1.25) attention.push({ kind: "more_requests", value: Math.round(((received - previous) / previous) * 100) });
  if (average !== null && average < 3.5) attention.push({ kind: "low_rating", value: average });
  if (unanswered > 0) attention.push({ kind: "unanswered", value: unanswered });
  if (locked > 0) attention.push({ kind: "locked", value: locked });

  return {
    days,
    from: from.toISOString(),
    to: now.toISOString(),
    requests: { received, previous, closed: closedRows.length, openNow, withoutAgent, urgentOpen, hoursToClose },
    appointments: { booked, asked },
    opinions: { count: opinions._count._all, average, unanswered },
    city: { alerts, announcements, newAccounts, posts },
    security: { failedSignIns: failed, lockedSignIns: locked },
    topServices: usage.rows.filter((row) => row.total > 0).slice(0, 5).map((row) => ({ name: row.name, total: row.total, share: row.share })),
    attention,
  };
}
