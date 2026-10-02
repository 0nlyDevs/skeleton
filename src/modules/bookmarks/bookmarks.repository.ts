import { prisma } from "@/lib/db/prisma";

export async function saveBookmark(userId: string, postId: string): Promise<void> {
  // Idempotent: saving twice is not an error.
  await prisma.postBookmark.upsert({
    where: { userId_postId: { userId, postId } },
    create: { userId, postId },
    update: {},
  });
}

export async function deleteBookmark(userId: string, postId: string): Promise<void> {
  await prisma.postBookmark.deleteMany({ where: { userId, postId } });
}

export async function findViewerBookmarks(postIds: readonly string[], userId: string): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const rows = await prisma.postBookmark.findMany({
    where: { userId, postId: { in: [...postIds] } },
    select: { postId: true },
  });
  return new Set(rows.map((row) => row.postId));
}

/** Newest saves first, keyset-paginated on (createdAt, postId). */
export async function findBookmarkPage(
  userId: string,
  before: { createdAt: Date; postId: string } | null,
  take: number,
): Promise<{ postId: string; createdAt: Date }[]> {
  return prisma.postBookmark.findMany({
    where: {
      userId,
      ...(before
        ? { OR: [{ createdAt: { lt: before.createdAt } }, { createdAt: before.createdAt, postId: { lt: before.postId } }] }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { postId: "desc" }],
    take,
    select: { postId: true, createdAt: true },
  });
}
