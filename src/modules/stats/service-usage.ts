/**
 * F98 — which services residents use most. "Use" is every time a resident
 * turned to a service: a request sent, an appointment booked or asked for,
 * an opinion given. The answer is a ranking with each service's share and
 * its change against the previous period, plus the few sentences a council
 * member needs: where the demand is, what is rising, what is not used.
 */

import { isStaff } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError } from "@/lib/errors";
import type { AuthUser } from "@/types";

export interface ServiceUsageRow {
  readonly slug: string;
  readonly name: string;
  readonly partner: boolean;
  readonly requests: number;
  readonly appointments: number;
  readonly opinions: number;
  readonly total: number;
  /** Share of all use over the period, 0–100. */
  readonly share: number;
  readonly previous: number;
  /** Change against the previous period, in percent; null when there was none before. */
  readonly change: number | null;
  /** Average opinion out of 5 over the period; null without any. */
  readonly rating: number | null;
}

export type UsageInsight =
  | { readonly kind: "top"; readonly name: string; readonly share: number }
  | { readonly kind: "concentration"; readonly count: number; readonly share: number }
  | { readonly kind: "rising"; readonly name: string; readonly change: number }
  | { readonly kind: "falling"; readonly name: string; readonly change: number }
  | { readonly kind: "unused"; readonly count: number; readonly names: string }
  | { readonly kind: "low_rating"; readonly name: string; readonly rating: number };

export interface ServiceUsageDto {
  readonly days: number;
  readonly total: number;
  readonly previousTotal: number;
  readonly rows: ServiceUsageRow[];
  readonly insights: UsageInsight[];
}

type Counts = Map<string, number>;

async function countsBetween(from: Date, to: Date): Promise<{ requests: Counts; appointments: Counts; opinions: Counts; ratings: Counts }> {
  const range = { gte: from, lt: to };
  const [requests, appointments, asked, opinions] = await Promise.all([
    prisma.cityRequest.groupBy({ by: ["serviceId"], where: { createdAt: range, serviceId: { not: null } }, _count: { _all: true } }),
    prisma.appointment.groupBy({ by: ["serviceId"], where: { createdAt: range, serviceId: { not: null } }, _count: { _all: true } }),
    prisma.appointmentRequest.groupBy({ by: ["serviceId"], where: { createdAt: range, serviceId: { not: null } }, _count: { _all: true } }),
    prisma.serviceFeedback.groupBy({ by: ["serviceId"], where: { createdAt: range }, _count: { _all: true }, _avg: { rating: true } }),
  ]);
  const toMap = (rows: readonly { serviceId: string | null; _count: { _all: number } }[], into: Counts = new Map()): Counts => {
    for (const row of rows) if (row.serviceId) into.set(row.serviceId, (into.get(row.serviceId) ?? 0) + row._count._all);
    return into;
  };
  const ratings: Counts = new Map();
  for (const row of opinions) if (row._avg.rating !== null) ratings.set(row.serviceId, row._avg.rating);
  return { requests: toMap(requests), appointments: toMap(asked, toMap(appointments)), opinions: toMap(opinions), ratings };
}

export async function getServiceUsage(actor: AuthUser, days = 30): Promise<ServiceUsageDto> {
  if (!isStaff(actor)) throw new ForbiddenError("Only city staff can read service usage.");
  const now = new Date();
  const span = days * 24 * 60 * 60_000;
  const start = new Date(now.getTime() - span);
  const [services, current, before] = await Promise.all([
    prisma.municipalService.findMany({ where: { active: true }, select: { id: true, slug: true, name: true, partner: true } }),
    countsBetween(start, now),
    countsBetween(new Date(start.getTime() - span), start),
  ]);
  const sum = (counts: { requests: Counts; appointments: Counts; opinions: Counts }, id: string): number =>
    (counts.requests.get(id) ?? 0) + (counts.appointments.get(id) ?? 0) + (counts.opinions.get(id) ?? 0);
  const total = services.reduce((all, service) => all + sum(current, service.id), 0);
  const previousTotal = services.reduce((all, service) => all + sum(before, service.id), 0);

  const rows: ServiceUsageRow[] = services
    .map((service) => {
      const used = sum(current, service.id);
      const previous = sum(before, service.id);
      const rating = current.ratings.get(service.id);
      return {
        slug: service.slug,
        name: service.name,
        partner: service.partner,
        requests: current.requests.get(service.id) ?? 0,
        appointments: current.appointments.get(service.id) ?? 0,
        opinions: current.opinions.get(service.id) ?? 0,
        total: used,
        share: total > 0 ? Math.round((used / total) * 100) : 0,
        previous,
        change: previous > 0 ? Math.round(((used - previous) / previous) * 100) : null,
        rating: rating === undefined ? null : Math.round(rating * 10) / 10,
      };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  const insights: UsageInsight[] = [];
  const used = rows.filter((row) => row.total > 0);
  const [first] = used;
  if (first) insights.push({ kind: "top", name: first.name, share: first.share });
  if (used.length > 3) insights.push({ kind: "concentration", count: 3, share: Math.round((used.slice(0, 3).reduce((all, row) => all + row.total, 0) / total) * 100) });
  const moving = used.filter((row) => row.change !== null && row.previous >= 3);
  const rising = [...moving].sort((a, b) => (b.change ?? 0) - (a.change ?? 0))[0];
  if (rising && (rising.change ?? 0) >= 20) insights.push({ kind: "rising", name: rising.name, change: rising.change ?? 0 });
  const falling = [...moving].sort((a, b) => (a.change ?? 0) - (b.change ?? 0))[0];
  if (falling && (falling.change ?? 0) <= -20) insights.push({ kind: "falling", name: falling.name, change: falling.change ?? 0 });
  const unused = rows.filter((row) => row.total === 0);
  if (unused.length > 0) insights.push({ kind: "unused", count: unused.length, names: unused.slice(0, 3).map((row) => row.name).join(", ") });
  const worst = used.filter((row) => row.rating !== null && row.opinions >= 2).sort((a, b) => (a.rating ?? 5) - (b.rating ?? 5))[0];
  if (worst && (worst.rating ?? 5) < 3.5) insights.push({ kind: "low_rating", name: worst.name, rating: worst.rating ?? 0 });

  return { days, total, previousTotal, rows, insights };
}
