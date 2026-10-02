/**
 * Comment persistence. `post.commentCount` moves in the same transaction as
 * the row it counts.
 */

import { type Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";

export const commentInclude = {
  user: { select: { id: true, name: true, username: true, image: true } },
  mentions: {
    select: { mentionedUser: { select: { id: true, username: true, name: true, banned: true } } },
  },
  reactions: { where: { user: { banned: false } }, orderBy: { createdAt: "asc" }, take: 300, select: { userId: true, type: true } },
} satisfies Prisma.CommentInclude;

export type CommentRow = Prisma.CommentGetPayload<{ include: typeof commentInclude }>;

export async function findCommentById(id: string): Promise<CommentRow | null> {
  return prisma.comment.findUnique({ where: { id }, include: commentInclude });
}

/**
 * Top-level comments, oldest first, keyset-paginated. A deleted comment stays
 * as a placeholder only while live replies hang under it.
 */
export async function findTopLevelComments(args: {
  postId: string;
  after: { createdAt: Date; id: string } | null;
  take: number;
  excludeUserIds?: readonly string[];
}): Promise<CommentRow[]> {
  const visible: Prisma.CommentWhereInput = {
    OR: [{ deletedAt: null }, { replies: { some: { deletedAt: null } } }],
    ...(args.excludeUserIds?.length ? { userId: { notIn: [...args.excludeUserIds] } } : {}),
  };
  const after: Prisma.CommentWhereInput | undefined = args.after
    ? {
        OR: [
          { createdAt: { gt: args.after.createdAt } },
          { createdAt: args.after.createdAt, id: { gt: args.after.id } },
        ],
      }
    : undefined;

  return prisma.comment.findMany({
    where: { AND: [{ postId: args.postId, parentId: null }, visible, ...(after ? [after] : [])] },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: args.take,
    include: commentInclude,
  });
}

/** Live replies for a page of threads, in one query. */
export async function findRepliesFor(parentIds: readonly string[], excludeUserIds: readonly string[] = []): Promise<CommentRow[]> {
  if (parentIds.length === 0) return [];
  return prisma.comment.findMany({
    where: { parentId: { in: [...parentIds] }, deletedAt: null, ...(excludeUserIds.length ? { userId: { notIn: [...excludeUserIds] } } : {}) },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 500,
    include: commentInclude,
  });
}

export async function insertComment(data: {
  postId: string;
  userId: string;
  parentId: string | null;
  body: string;
}): Promise<CommentRow> {
  const [row] = await prisma.$transaction([
    prisma.comment.create({ data, include: commentInclude }),
    prisma.post.update({ where: { id: data.postId }, data: { commentCount: { increment: 1 } } }),
  ]);
  return row;
}

export async function updateCommentBody(id: string, body: string): Promise<CommentRow> {
  return prisma.comment.update({
    where: { id },
    data: { body, editedAt: new Date() },
    include: commentInclude,
  });
}

/** Soft delete; only a still-live comment decrements the counter. */
export async function softDeleteComment(id: string, postId: string): Promise<CommentRow> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.comment.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (count > 0) {
      await tx.post.update({ where: { id: postId }, data: { commentCount: { decrement: 1 } } });
    }
    return tx.comment.findUniqueOrThrow({ where: { id }, include: commentInclude });
  });
}

export async function setCommentReaction(commentId: string, userId: string, type: string | null): Promise<"created" | "updated" | "removed"> {
  if (!type) {
    await prisma.commentReaction.deleteMany({ where: { commentId, userId } });
    return "removed";
  }
  const existing = await prisma.commentReaction.findUnique({ where: { commentId_userId: { commentId, userId } }, select: { type: true } });
  await prisma.commentReaction.upsert({
    where: { commentId_userId: { commentId, userId } },
    create: { commentId, userId, type },
    update: { type },
  });
  return existing ? "updated" : "created";
}

export async function findCommentReactors(commentId: string) {
  return prisma.commentReaction.findMany({
    where: { commentId, user: { banned: false } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { type: true, user: { select: { id: true, name: true, username: true, image: true } } },
  });
}

