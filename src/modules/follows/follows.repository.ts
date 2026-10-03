import { prisma } from "@/lib/db/prisma";

export async function findFollow(followerId: string, followingId: string): Promise<boolean> {
  const row = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
    select: { id: true },
  });
  return Boolean(row);
}

export async function createFollow(followerId: string, followingId: string): Promise<boolean> {
  const existing = await findFollow(followerId, followingId);
  if (existing) return false;
  try {
    await prisma.follow.create({ data: { followerId, followingId } });
    return true;
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return false;
    throw error;
  }
}

export async function deleteFollow(followerId: string, followingId: string): Promise<void> {
  await prisma.follow.deleteMany({ where: { followerId, followingId } });
}

const connectionUser = { select: { id: true, name: true, username: true, image: true, role: true } } as const;

/** People following `userId` (or followed by them), newest first, keyset by follow id. */
export async function findConnections(
  userId: string,
  kind: "followers" | "following",
  cursor: string | null,
  take: number,
): Promise<{ followId: string; user: { id: string; name: string; username: string | null; image: string | null; role: "USER" | "AGENT" | "ADMIN" } }[]> {
  const rows = await prisma.follow.findMany({
    where:
      kind === "followers"
        ? { followingId: userId, follower: { banned: false, username: { not: null } } }
        : { followerId: userId, following: { banned: false, username: { not: null } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, follower: connectionUser, following: connectionUser },
  });
  return rows.map((row) => ({ followId: row.id, user: kind === "followers" ? row.follower : row.following }));
}

/** Of `ids`, who `viewerId` follows and who follows `viewerId`. */
export async function findRelations(viewerId: string, ids: readonly string[]): Promise<{ following: Set<string>; followers: Set<string> }> {
  if (ids.length === 0) return { following: new Set(), followers: new Set() };
  const [following, followers] = await Promise.all([
    prisma.follow.findMany({ where: { followerId: viewerId, followingId: { in: [...ids] } }, select: { followingId: true } }),
    prisma.follow.findMany({ where: { followingId: viewerId, followerId: { in: [...ids] } }, select: { followerId: true } }),
  ]);
  return { following: new Set(following.map((row) => row.followingId)), followers: new Set(followers.map((row) => row.followerId)) };
}

/** Of `ids`, the people who follow `userId`. */
export async function findFollowerIdsAmong(userId: string, ids: readonly string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.follow.findMany({ where: { followingId: userId, followerId: { in: [...ids] } }, select: { followerId: true } });
  return rows.map((row) => row.followerId);
}
