/**
 * F52 — the public board of reported problems.
 *
 * A "report" is a city request that names a kind of problem (`issueType`). The
 * board deliberately shows only what is public: the subject, the kind, the
 * district, the state and how many residents back it. Never a name and never
 * the message — those stay between the resident and the services.
 *
 * Any resident can back a report once ("Je suis aussi concerné"); the unique
 * constraint on (requestId, userId) makes a double support impossible, and the
 * counter is kept in the same transaction as the row it counts.
 */

import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { RATE_LIMITS, enforceThenRecord, rateLimitKey } from "@/lib/rate-limit";
import type { AuthUser } from "@/types";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";
import type { ListReportsQuery, SimilarReportsQuery } from "./city-requests.schema";

const OPEN = ["NEW", "IN_PROGRESS", "WAITING_CITIZEN"] as const;
const DONE = ["RESOLVED", "CLOSED"] as const;

export interface ReportDto {
  readonly reference: string;
  readonly subject: string;
  readonly status: string;
  readonly issueType: string;
  readonly zone: string | null;
  readonly supportCount: number;
  readonly createdAt: string;
  /** When the viewer started backing it, or null. */
  readonly supportedAt: string | null;
}

export interface ReportPage {
  readonly data: ReportDto[];
  readonly total: number;
  readonly page: number;
  readonly pageCount: number;
}

const reportSelect = {
  id: true,
  reference: true,
  subject: true,
  status: true,
  issueType: true,
  zone: true,
  supportCount: true,
  createdAt: true,
} as const;

type ReportRow = {
  id: string;
  reference: string;
  subject: string;
  status: string;
  issueType: string | null;
  zone: string | null;
  supportCount: number;
  createdAt: Date;
};

async function attachSupport(rows: readonly ReportRow[], viewerId: string | null): Promise<ReportDto[]> {
  const ids = rows.map((row) => row.id);
  const mine = viewerId && ids.length > 0
    ? await prisma.cityRequestSupport.findMany({ where: { userId: viewerId, requestId: { in: ids } }, select: { requestId: true, createdAt: true } })
    : [];
  const byRequest = new Map(mine.map((support) => [support.requestId, support.createdAt]));
  return rows.map((row) => ({
    reference: row.reference,
    subject: row.subject,
    status: row.status,
    issueType: row.issueType ?? "other",
    zone: row.zone,
    supportCount: row.supportCount,
    createdAt: row.createdAt.toISOString(),
    supportedAt: byRequest.get(row.id)?.toISOString() ?? null,
  }));
}

function statusFilter(status: "OPEN" | "DONE" | undefined) {
  if (status === "OPEN") return { status: { in: [...OPEN] } };
  if (status === "DONE") return { status: { in: [...DONE] } };
  return {};
}

export async function listReports(query: ListReportsQuery, viewer: AuthUser | null): Promise<ReportPage> {
  const where = {
    issueType: { not: null },
    ...statusFilter(query.status),
    ...(query.issueType ? { issueType: query.issueType } : {}),
    ...(query.zone ? { zone: query.zone } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.cityRequest.findMany({
      where,
      select: reportSelect,
      orderBy: query.sort === "supported" ? [{ supportCount: "desc" }, { createdAt: "desc" }] : [{ createdAt: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.cityRequest.count({ where }),
  ]);
  return {
    data: await attachSupport(rows, viewer?.id ?? null),
    total,
    page: query.page,
    pageCount: Math.ceil(total / query.limit),
  };
}

/** F52 — open reports near a new one, so a resident can back them instead. */
export async function similarReports(query: SimilarReportsQuery, viewer: AuthUser | null): Promise<ReportDto[]> {
  if (!query.issueType && !query.zone) return [];
  const rows = await prisma.cityRequest.findMany({
    where: {
      issueType: { not: null },
      status: { in: [...OPEN] },
      ...(query.issueType ? { issueType: query.issueType } : {}),
      ...(query.zone ? { zone: query.zone } : {}),
    },
    select: reportSelect,
    orderBy: [{ supportCount: "desc" }, { createdAt: "desc" }],
    take: 3,
  });
  return await attachSupport(rows, viewer?.id ?? null);
}

async function loadReport(reference: string) {
  const row = await prisma.cityRequest.findUnique({
    where: { reference },
    select: { id: true, issueType: true, status: true, assigneeId: true, citizenId: true },
  });
  if (!row || !row.issueType) throw new NotFoundError("This report does not exist.");
  return row;
}

export async function supportReport(reference: string, actor: AuthUser, ip: string | null = null): Promise<{ supportCount: number; supportedAt: string }> {
  const row = await loadReport(reference);
  if (row.status === "CLOSED") throw new ForbiddenError("This report is closed.");
  await enforceThenRecord([{ key: rateLimitKey("report:support", actor.id), rule: RATE_LIMITS.reportSupport }]);

  let supportedAt = new Date();
  const existing = await prisma.cityRequestSupport.findUnique({ where: { requestId_userId: { requestId: row.id, userId: actor.id } } });
  if (existing) {
    supportedAt = existing.createdAt;
  } else {
    await prisma.$transaction([
      prisma.cityRequestSupport.create({ data: { requestId: row.id, userId: actor.id } }),
      prisma.cityRequest.update({ where: { id: row.id }, data: { supportCount: { increment: 1 } } }),
    ]);
    await recordAudit({ actorId: actor.id, action: auditActions.cityRequestChanged, targetType: "city_request", targetId: row.id, metadata: { op: "support", reference }, ip });
  }
  const fresh = await prisma.cityRequest.findUnique({ where: { id: row.id }, select: { supportCount: true } });
  return { supportCount: fresh?.supportCount ?? 1, supportedAt: supportedAt.toISOString() };
}

export async function withdrawReportSupport(reference: string, actor: AuthUser): Promise<{ supportCount: number; supportedAt: null }> {
  const row = await loadReport(reference);
  const existing = await prisma.cityRequestSupport.findUnique({ where: { requestId_userId: { requestId: row.id, userId: actor.id } } });
  if (!existing) {
    const fresh = await prisma.cityRequest.findUnique({ where: { id: row.id }, select: { supportCount: true } });
    return { supportCount: fresh?.supportCount ?? 0, supportedAt: null };
  }
  await prisma.$transaction([
    prisma.cityRequestSupport.delete({ where: { id: existing.id } }),
    prisma.cityRequest.update({ where: { id: row.id }, data: { supportCount: { decrement: 1 } } }),
  ]);
  await recordAudit({ actorId: actor.id, action: auditActions.cityRequestChanged, targetType: "city_request", targetId: row.id, metadata: { op: "unsupport", reference }, ip: null });
  const fresh = await prisma.cityRequest.findUnique({ where: { id: row.id }, select: { supportCount: true } });
  return { supportCount: fresh?.supportCount ?? 0, supportedAt: null };
}

/** F52 — everyone backing a report, so the services' answers reach them too. */
export async function reportSupporters(requestId: string): Promise<string[]> {
  const rows = await prisma.cityRequestSupport.findMany({ where: { requestId }, select: { userId: true } });
  return rows.map((row) => row.userId);
}
