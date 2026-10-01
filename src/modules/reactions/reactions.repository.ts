/**
 * Reaction persistence.
 *
 * The per-post `reactionCount` on `post` is changed in the same transaction as
 * the reaction row, so the counter the feed reads can never drift from the
 * rows it counts.
 */

import type { ReactionType as DbReactionType } from "@/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";
import type { ReactionCounts, ReactionType } from "@/types";

export type ReactionChange = "created" | "changed" | "unchanged";

/** Insert or retype the caller's reaction. Reports what actually happened. */
export async function upsertReaction(input: {
  postId: string;
  userId: string;
  type: ReactionType;
}): Promise<ReactionChange> {
  const existing = await prisma.postReaction.findUnique({
    where: { postId_userId: { postId: input.postId, userId: input.userId } },
    select: { type: true },
  });

  if (existing) {
    if (existing.type === input.type) return "unchanged";
    await prisma.postReaction.update({
      where: { postId_userId: { postId: input.postId, userId: input.userId } },
      data: { type: input.type as DbReactionType },
    });
    return "changed";
  }

  try {
    await prisma.$transaction([
      prisma.postReaction.create({
        data: { postId: input.postId, userId: input.userId, type: input.type as DbReactionType },
      }),
      prisma.post.update({ where: { id: input.postId }, data: { reactionCount: { increment: 1 } } }),
    ]);
    return "created";
  } catch (error) {
    // A double tap raced us to the insert; the unique index kept one row, so
    // this request becomes a retype of that row.
    if ((error as { code?: string }).code !== "P2002") throw error;
    await prisma.postReaction.update({
      where: { postId_userId: { postId: input.postId, userId: input.userId } },
      data: { type: input.type as DbReactionType },
    });
    return "changed";
  }
}

/** Remove the caller's reaction. Returns whether one existed. */
export async function deleteReaction(postId: string, userId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.postReaction.deleteMany({ where: { postId, userId } });
    if (count > 0) {
      await tx.post.update({ where: { id: postId }, data: { reactionCount: { decrement: count } } });
    }
    return count > 0;
  });
}

/** Per-type totals for a page of posts, in one grouped query. */
export async function countReactionsByType(
  postIds: readonly string[],
): Promise<Map<string, ReactionCounts>> {
  const result = new Map<string, ReactionCounts>();
  if (postIds.length === 0) return result;

  const rows = await prisma.postReaction.groupBy({
    by: ["postId", "type"],
    where: { postId: { in: [...postIds] } },
    _count: { _all: true },
  });

  for (const row of rows) {
    const counts = result.get(row.postId) ?? {};
    counts[row.type as ReactionType] = row._count._all;
    result.set(row.postId, counts);
  }
  return result;
}

/** The viewer's own reaction on each post of a page, in one query. */
export async function findViewerReactions(
  postIds: readonly string[],
  userId: string,
): Promise<Map<string, ReactionType>> {
  if (postIds.length === 0) return new Map();
  const rows = await prisma.postReaction.findMany({
    where: { userId, postId: { in: [...postIds] } },
    select: { postId: true, type: true },
  });
  return new Map(rows.map((row) => [row.postId, row.type as ReactionType]));
}

export async function findPostCounters(
  postId: string,
): Promise<{ commentCount: number; reactionCount: number; shareCount: number } | null> {
  return prisma.post.findUnique({
    where: { id: postId },
    select: { commentCount: true, reactionCount: true, shareCount: true },
  });
}

/** Who reacted to a post, newest first, for the "who reacted" list. */
export async function findReactors(postId: string, take: number) {
  return prisma.postReaction.findMany({
    where: { postId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      type: true,
      user: { select: { id: true, name: true, username: true, image: true } },
    },
  });
}
