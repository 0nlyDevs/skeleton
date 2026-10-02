import { type Prisma } from "@/generated/prisma/client";

import { decryptField } from "@/lib/crypto/field-encryption";
import { prisma } from "@/lib/db/prisma";

export const reportInclude = {
  reporter: { select: { id: true, name: true } },
  resolvedBy: { select: { id: true, name: true } },
} satisfies Prisma.ReportInclude;

export type ReportWithActors = Prisma.ReportGetPayload<{ include: typeof reportInclude }>;

export interface FindReportsArgs {
  readonly where: Prisma.ReportWhereInput;
  readonly skip: number;
  readonly take: number;
}

export async function createReport(
  data: Prisma.ReportUncheckedCreateInput,
): Promise<ReportWithActors> {
  return prisma.report.create({ data, include: reportInclude });
}

export async function findReports(args: FindReportsArgs): Promise<ReportWithActors[]> {
  return prisma.report.findMany({
    where: args.where,
    orderBy: { createdAt: "desc" },
    skip: args.skip,
    take: args.take,
    include: reportInclude,
  });
}

export async function countReports(where: Prisma.ReportWhereInput): Promise<number> {
  return prisma.report.count({ where });
}

export async function findReportById(id: string): Promise<ReportWithActors | null> {
  return prisma.report.findUnique({ where: { id }, include: reportInclude });
}

export async function updateReport(
  id: string,
  data: Prisma.ReportUncheckedUpdateInput,
): Promise<ReportWithActors> {
  return prisma.report.update({ where: { id }, data, include: reportInclude });
}

const STALE_RESOLUTION_MS = 15 * 60_000;

/** Claim an open report; an abandoned claim can be taken over after 15 minutes. */
export async function claimReportResolution(id: string, actorId: string, now = new Date()): Promise<boolean> {
  const fresh = await prisma.report.updateMany({
    where: { id, status: "OPEN", resolvedById: null },
    data: { resolvedById: actorId, updatedAt: now },
  });
  if (fresh.count > 0) return true;

  const staleBefore = new Date(now.getTime() - STALE_RESOLUTION_MS);
  const takeover = await prisma.report.updateMany({
    where: { id, status: "OPEN", resolvedById: { not: null }, updatedAt: { lt: staleBefore } },
    data: { resolvedById: actorId, updatedAt: now },
  });
  return takeover.count > 0;
}

export async function completeReportResolution(
  id: string,
  actorId: string,
  data: { status: "RESOLVED" | "DISMISSED"; resolutionNote: string | null },
): Promise<ReportWithActors | null> {
  const result = await prisma.report.updateMany({
    where: { id, status: "OPEN", resolvedById: actorId },
    data: { ...data, duplicateKey: null },
  });
  if (result.count === 0) return null;
  return findReportById(id);
}

export async function releaseReportResolution(id: string, actorId: string): Promise<void> {
  await prisma.report.updateMany({
    where: { id, status: "OPEN", resolvedById: actorId },
    data: { resolvedById: null, resolutionNote: null, updatedAt: new Date() },
  });
}

export async function countOpenReports(): Promise<number> {
  return prisma.report.count({ where: { status: "OPEN" } });
}

/**
 * Titles for a batch of reported posts, so the moderation queue can show what
 * was reported without an N+1 query per row.
 */
export async function findReportedPostTitles(
  postIds: readonly string[],
): Promise<Map<string, string>> {
  if (postIds.length === 0) return new Map();

  const rows = await prisma.post.findMany({
    where: { id: { in: [...postIds] } },
    select: { id: true, title: true },
  });

  return new Map(rows.map((row) => [row.id, row.title]));
}

export interface ReportedTargetSummary {
  readonly label: string;
  readonly summary: string | null;
  readonly href: string | null;
}

export async function findReportedTargetSummaries(
  targets: readonly { targetType: string; targetId: string }[],
): Promise<Map<string, ReportedTargetSummary>> {
  const idsByType = new Map<string, string[]>();
  for (const target of targets) {
    const ids = idsByType.get(target.targetType) ?? [];
    ids.push(target.targetId);
    idsByType.set(target.targetType, ids);
  }

  const [posts, comments, messages, users, pages] = await Promise.all([
    prisma.post.findMany({
      where: { id: { in: idsByType.get("post") ?? [] } },
      select: { id: true, title: true, body: true },
    }),
    prisma.comment.findMany({
      where: { id: { in: idsByType.get("comment") ?? [] } },
      select: { id: true, postId: true, body: true, deletedAt: true },
    }),
    prisma.message.findMany({
      where: { id: { in: idsByType.get("message") ?? [] } },
      select: { id: true, roomId: true, content: true, deletedAt: true },
    }),
    prisma.user.findMany({
      where: { id: { in: idsByType.get("user") ?? [] } },
      select: { id: true, name: true, username: true, bio: true },
    }),
    prisma.page.findMany({
      where: { id: { in: idsByType.get("page") ?? [] } },
      select: { id: true, slug: true, title: true, tagline: true, deletedAt: true },
    }),
  ]);

  const summaries = new Map<string, ReportedTargetSummary>();
  for (const post of posts) {
    summaries.set(`post:${post.id}`, {
      label: post.title,
      summary: post.body.slice(0, 320),
      href: `/feed/${encodeURIComponent(post.id)}`,
    });
  }
  for (const comment of comments) {
    summaries.set(`comment:${comment.id}`, {
      label: comment.deletedAt ? "Commentaire supprimé" : "Commentaire",
      summary: comment.deletedAt ? null : comment.body.slice(0, 320),
      href: `/feed/${encodeURIComponent(comment.postId)}#comments`,
    });
  }
  for (const message of messages) {
    summaries.set(`message:${message.id}`, {
      label: message.deletedAt ? "Message supprimé" : "Message",
      summary: message.deletedAt ? null : decryptField(message.content).slice(0, 320),
      href: null,
    });
  }
  for (const user of users) {
    summaries.set(`user:${user.id}`, {
      label: user.username ? `@${user.username}` : user.name,
      summary: user.bio?.slice(0, 320) ?? null,
      href: user.username ? `/u/${encodeURIComponent(user.username)}` : null,
    });
  }

  for (const page of pages) {
    summaries.set(`page:${page.id}`, {
      label: page.deletedAt ? "Page supprimée" : `Page « ${page.title} »`,
      summary: page.tagline,
      href: page.deletedAt ? null : `/p/${encodeURIComponent(page.slug)}`,
    });
  }

  return summaries;
}
