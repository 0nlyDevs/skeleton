import { type Prisma } from "@prisma/client";

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
