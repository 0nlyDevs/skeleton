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
