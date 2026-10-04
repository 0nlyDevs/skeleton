/**
 * F50 — the agents' activity at a glance: what arrived, what is waiting, how
 * fast the city answers and resolves, what is happening today, and a 14-day
 * picture. One cached aggregate (a minute), so a busy dashboard costs one
 * query set, not one per agent.
 */

import { isAdmin, isStaff } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError } from "@/lib/errors";
import type { AuthUser } from "@/types";

import { auditActions } from "../audit/audit.schema";

const DAY = 24 * 60 * 60_000;
const CACHE_MS = 60_000;

export interface AgentDashboardDto {
  readonly generatedAt: string;
  readonly received: { readonly today: number; readonly week: number };
  readonly open: { readonly new: number; readonly inProgress: number; readonly waitingCitizen: number; readonly awaitingPickup: number };
  /** Hours, one decimal; null while there is no data. */
  readonly averages: { readonly firstAnswerHours: number | null; readonly resolutionHours: number | null };
  readonly appointmentsToday: number;
  readonly activeAlerts: number;
  readonly disruptedServices: number;
  readonly commentsToRead: number;
  readonly emergencies: number;
  /** Administrators only. */
  readonly failedSignIns24h: number | null;
  readonly chart: { readonly day: string; readonly received: number; readonly resolved: number }[];
}

let cache: { at: number; value: Omit<AgentDashboardDto, "failedSignIns24h"> & { failed: number } } | null = null;

const round = (value: number) => Math.round(value * 10) / 10;

async function compute() {
  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekAgo = new Date(startOfToday.getTime() - 6 * DAY);
  const chartFrom = new Date(startOfToday.getTime() - 13 * DAY);
  const [byStatus, awaiting, today, week, appointments, alerts, disrupted, comments, emergencies, failed, recent, resolved] = await Promise.all([
    prisma.cityRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.cityRequest.count({ where: { assigneeId: null, status: { in: ["NEW", "IN_PROGRESS", "WAITING_CITIZEN"] } } }),
    prisma.cityRequest.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.cityRequest.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.appointment.count({ where: { startsAt: { gte: startOfToday, lt: new Date(startOfToday.getTime() + DAY) }, status: "BOOKED" } }),
    prisma.announcement.count({ where: { category: "ALERT", alertStatus: "ACTIVE", publishedAt: { not: null }, deletedAt: null } }),
    prisma.municipalService.count({ where: { active: true, availability: { not: "AVAILABLE" } } }),
    prisma.serviceFeedback.count({ where: { status: "RECEIVED" } }),
    prisma.cityRequest.count({ where: { priority: "URGENT", status: { in: ["NEW", "IN_PROGRESS", "WAITING_CITIZEN"] } } }),
    prisma.auditLog.count({ where: { action: auditActions.signInFailed, createdAt: { gte: new Date(now.getTime() - DAY) } } }),
    prisma.cityRequest.findMany({
      where: { createdAt: { gte: new Date(now.getTime() - 30 * DAY) } },
      take: 2_000,
      select: { createdAt: true, citizenId: true, messages: { where: { internal: false }, orderBy: { createdAt: "asc" }, take: 5, select: { authorId: true, createdAt: true } } },
    }),
    prisma.cityRequest.findMany({ where: { closedAt: { gte: chartFrom } }, take: 3_000, select: { createdAt: true, closedAt: true } }),
  ]);

  const count = (status: string) => byStatus.find((entry) => entry.status === status)?._count._all ?? 0;

  const firstAnswers = recent.flatMap((request) => {
    const answer = request.messages.find((message) => message.authorId !== request.citizenId);
    return answer ? [(answer.createdAt.getTime() - request.createdAt.getTime()) / 3_600_000] : [];
  });
  const closed = await prisma.cityRequest.findMany({ where: { closedAt: { not: null }, createdAt: { gte: new Date(now.getTime() - 60 * DAY) } }, take: 2_000, select: { createdAt: true, closedAt: true } });
  const durations = closed.flatMap((request) => (request.closedAt ? [(request.closedAt.getTime() - request.createdAt.getTime()) / 3_600_000] : []));
  const average = (values: number[]) => (values.length > 0 ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null);

  const chart = Array.from({ length: 14 }, (_, index) => {
    const from = chartFrom.getTime() + index * DAY;
    const to = from + DAY;
    return {
      day: new Date(from).toISOString().slice(0, 10),
      received: recent.filter((request) => request.createdAt.getTime() >= from && request.createdAt.getTime() < to).length,
      resolved: resolved.filter((request) => request.closedAt && request.closedAt.getTime() >= from && request.closedAt.getTime() < to).length,
    };
  });

  return {
    generatedAt: now.toISOString(),
    received: { today, week },
    open: { new: count("NEW"), inProgress: count("IN_PROGRESS"), waitingCitizen: count("WAITING_CITIZEN"), awaitingPickup: awaiting },
    averages: { firstAnswerHours: average(firstAnswers), resolutionHours: average(durations) },
    appointmentsToday: appointments,
    activeAlerts: alerts,
    disruptedServices: disrupted,
    commentsToRead: comments,
    emergencies,
    chart,
    failed,
  };
}

export async function getAgentDashboard(actor: AuthUser): Promise<AgentDashboardDto> {
  if (!isStaff(actor)) throw new ForbiddenError("Only city agents can see the activity dashboard.");
  if (!cache || Date.now() - cache.at > CACHE_MS) cache = { at: Date.now(), value: await compute() };
  const { failed, ...rest } = cache.value;
  return { ...rest, failedSignIns24h: isAdmin(actor) ? failed : null };
}
