/**
 * D21 — the agents' history: every administrative action, who did it, on what
 * and when, so the city can justify it and agents can follow the day's work.
 * It reads the audit trail (append-only, written by each service through
 * `recordAudit`) and keeps only administrative actions; IP addresses stay in
 * the administrators' raw audit view.
 */

import type { Prisma } from "@/generated/prisma/client";

import { isStaff } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError } from "@/lib/errors";
import { paginate, toPagination, type Paginated } from "@/lib/pagination";
import type { AuthUser, Role } from "@/types";

import { ADMIN_ACTION_CATEGORIES, ADMIN_ACTIONS, auditActions } from "../audit/audit.schema";
import type { ActivityEntryDto } from "./activity.dto";
import type { ListActivityQuery } from "./activity.schema";

const SENSITIVE_KEY = /pass(word)?|secret|token|authorization|cookie|api[-_]?key|^ip$/i;

const CATEGORY_OF: Record<string, string> = Object.fromEntries(
  Object.entries(ADMIN_ACTION_CATEGORIES).flatMap(([category, actions]) => actions.map((action) => [action, category])),
);

function periodStart(period: ListActivityQuery["period"]): Date | null {
  const now = new Date();
  if (period === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "7d") return new Date(now.getTime() - 7 * 86_400_000);
  if (period === "30d") return new Date(now.getTime() - 30 * 86_400_000);
  return null;
}

function buildWhere(query: ListActivityQuery): Prisma.AuditLogWhereInput {
  const actions = query.category === "all" ? ADMIN_ACTIONS : (ADMIN_ACTION_CATEGORIES[query.category as keyof typeof ADMIN_ACTION_CATEGORIES] ?? []);
  const plain = actions.filter((action) => action !== auditActions.userSessionsRevoked);
  const from = periodStart(query.period);
  return {
    // A resident closing their own other sessions is not an administrative act:
    // only "signed out by an agent" belongs here.
    OR: [
      { action: { in: [...plain] } },
      ...(actions.includes(auditActions.userSessionsRevoked)
        ? [{ action: auditActions.userSessionsRevoked, metadata: { path: "$.by", equals: "agent" } }]
        : []),
    ],
    ...(from ? { createdAt: { gte: from } } : {}),
    ...(query.actor ? { user: { name: { contains: query.actor } } } : {}),
    ...(query.targetType ? { targetType: query.targetType } : {}),
    ...(query.targetId ? { targetId: query.targetId } : {}),
  };
}

function scrub(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return Object.fromEntries(Object.entries(metadata as Record<string, unknown>).filter(([key]) => !SENSITIVE_KEY.test(key)));
}

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value : null);

type Row = Prisma.AuditLogGetPayload<{ include: { user: { select: { id: true; name: true; role: true } } } }>;

/** Names, references and titles for the targets, read in a few batched queries. */
async function resolveTargets(rows: readonly Row[]): Promise<Map<string, { label: string | null; href: string | null }>> {
  const ids = (type: string) => [...new Set(rows.filter((row) => row.targetType === type && row.targetId).map((row) => row.targetId as string))];
  const authorIds = rows.map((row) => text((row.metadata as Record<string, unknown> | null)?.authorId)).filter((id): id is string => id !== null);
  const [users, requests, announcements, services] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: [...ids("user"), ...authorIds] } }, select: { id: true, name: true } }),
    prisma.cityRequest.findMany({ where: { id: { in: ids("city_request") } }, select: { id: true, reference: true } }),
    prisma.announcement.findMany({ where: { id: { in: ids("announcement") } }, select: { id: true, title: true, slug: true, deletedAt: true } }),
    prisma.municipalService.findMany({ where: { id: { in: ids("service") } }, select: { id: true, name: true, slug: true } }),
  ]);
  const map = new Map<string, { label: string | null; href: string | null }>();
  for (const user of users) map.set(`user:${user.id}`, { label: user.name, href: null });
  for (const request of requests) map.set(`city_request:${request.id}`, { label: request.reference, href: `/agent/requests/${request.reference}` });
  for (const item of announcements) map.set(`announcement:${item.id}`, { label: item.title, href: item.deletedAt ? null : `/announcements/${item.slug}` });
  for (const service of services) map.set(`service:${service.id}`, { label: service.name, href: `/services/${service.slug}` });
  return map;
}

function toEntry(row: Row, targets: Map<string, { label: string | null; href: string | null }>): ActivityEntryDto {
  const meta = scrub(row.metadata);
  const known = row.targetType && row.targetId ? targets.get(`${row.targetType}:${row.targetId}`) : undefined;
  // What the metadata recorded at the time wins for the label: it survives renames and deletions.
  const recorded =
    text(meta.reference) ??
    text(meta.title) ??
    (text(meta.code) && text(meta.name) ? `${String(meta.code)} · ${String(meta.name)}` : null) ??
    text(meta.name) ??
    (row.targetType === "webcup_request" || row.targetType === "feature_flag" ? row.targetId : null);
  const href =
    known?.href ??
    (row.targetType === "transport_line"
      ? "/agent/transports"
      : row.targetType === "webcup_request"
        ? "/agent/feed"
        : row.targetType === "appointment" && text(meta.reference)
          ? `/agent/appointments/${String(meta.reference)}`
          : null);
  const authorName = text(meta.authorId) ? (targets.get(`user:${String(meta.authorId)}`)?.label ?? null) : null;
  return {
    id: row.id,
    action: row.action,
    category: CATEGORY_OF[row.action] ?? "other",
    op: text(meta.op),
    actor: row.user ? { id: row.user.id, name: row.user.name, role: row.user.role as Role } : null,
    target: row.targetType && row.targetId ? { type: row.targetType, id: row.targetId, label: recorded ?? known?.label ?? null, href } : null,
    details: { ...meta, ...(authorName ? { authorName } : {}) },
    createdAt: row.createdAt.toISOString(),
  };
}

function assertStaff(viewer: AuthUser): void {
  if (!isStaff(viewer)) throw new ForbiddenError("Only city agents can see the history.");
}

export async function listActivity(query: ListActivityQuery, viewer: AuthUser): Promise<Paginated<ActivityEntryDto>> {
  assertStaff(viewer);
  const where = buildWhere(query);
  const pagination = toPagination(query);
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.auditLog.count({ where }),
  ]);
  const targets = await resolveTargets(rows);
  return paginate(rows.map((row) => toEntry(row, targets)), { page: pagination.page, limit: pagination.limit, total });
}

/** Every matching entry (capped), for the CSV export. */
export async function exportActivity(query: ListActivityQuery, viewer: AuthUser): Promise<ActivityEntryDto[]> {
  assertStaff(viewer);
  const rows = await prisma.auditLog.findMany({
    where: buildWhere(query),
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 5_000,
  });
  const targets = await resolveTargets(rows);
  return rows.map((row) => toEntry(row, targets));
}
