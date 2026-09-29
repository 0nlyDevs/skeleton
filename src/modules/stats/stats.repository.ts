/**
 * Dashboard aggregations.
 *
 * Each function is a single indexed `count`/`aggregate` rather than a loop, and
 * the service calls them in parallel. On shared hosting the difference between
 * one round trip and six shows up directly in page latency, so the expensive
 * panels are the ones worth caching.
 */

import { prisma } from "@/lib/db/prisma";

export async function countPostsForUser(userId: string) {
  const [total, published] = await Promise.all([
    prisma.post.count({ where: { userId, deletedAt: null } }),
    prisma.post.count({ where: { userId, deletedAt: null, published: true } }),
  ]);
  return { total, published, drafts: total - published };
}

export async function countMessagesForUser(userId: string): Promise<number> {
  return prisma.message.count({ where: { senderId: userId } });
}

export async function countUnreadNotificationsForUser(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, read: false } });
}

export async function storageForUser(userId: string) {
  const result = await prisma.upload.aggregate({
    where: { userId },
    _count: { _all: true },
    _sum: { size: true },
  });
  return { files: result._count._all, bytes: result._sum.size ?? 0 };
}

export async function recentAuditForUser(userId: string, take: number) {
  return prisma.auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, action: true, targetType: true, targetId: true, createdAt: true },
  });
}

/**
 * Aggregate counts safe to publish on the landing page.
 *
 * Deliberately three `count(*)` calls and nothing else: no identifiers, no
 * emails, no per-user data. A visitor learns how busy the instance is and never
 * learns anything about who is on it.
 */
export async function publicCounts() {
  const [members, publishedPosts, auditedActions] = await Promise.all([
    prisma.user.count({ where: { banned: false } }),
    prisma.post.count({ where: { deletedAt: null, published: true } }),
    prisma.auditLog.count(),
  ]);
  return { members, publishedPosts, auditedActions };
}

// --- Admin ------------------------------------------------------------------

export async function adminUserCounts() {
  const [total, banned, verified, byRole] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { banned: true } }),
    prisma.user.count({ where: { emailVerified: true } }),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
  ]);

  return {
    total,
    banned,
    verified,
    byRole: Object.fromEntries(byRole.map((row) => [row.role, row._count._all])) as Record<string, number>,
  };
}

export async function adminPostCounts() {
  const [total, published, deleted] = await Promise.all([
    prisma.post.count(),
    prisma.post.count({ where: { deletedAt: null, published: true } }),
    prisma.post.count({ where: { deletedAt: { not: null } } }),
  ]);
  return { total, published, deleted };
}

export async function countOpenReports(): Promise<number> {
  return prisma.report.count({ where: { status: "OPEN" } });
}

export async function countAuditSince(since: Date): Promise<number> {
  return prisma.auditLog.count({ where: { createdAt: { gte: since } } });
}

export async function totalStorageBytes(): Promise<number> {
  const result = await prisma.upload.aggregate({ _sum: { size: true } });
  return result._sum.size ?? 0;
}

/** Sign-ups per day for the last `days` days, for the admin growth panel. */
export async function signupsPerDay(since: Date) {
  const rows = await prisma.user.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const buckets = new Map<string, number>();
  for (const row of rows) {
    const day = row.createdAt.toISOString().slice(0, 10);
    buckets.set(day, (buckets.get(day) ?? 0) + 1);
  }

  return Array.from(buckets.entries()).map(([day, count]) => ({ day, count }));
}

/** Most recent reports for the moderation preview on the admin dashboard. */
export async function recentOpenReports(take: number) {
  return prisma.report.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      targetType: true,
      targetId: true,
      reason: true,
      createdAt: true,
      reporter: { select: { id: true, name: true } },
    },
  });
}
