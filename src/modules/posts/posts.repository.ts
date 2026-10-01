/**
 * Post persistence.
 *
 * This layer knows Prisma and nothing else: no authorization, no business rules,
 * no HTTP. Every function takes a fully-formed `where`/`data` object, so the
 * decisions live in the service where they can be read in one place.
 *
 * The author relation is always selected through a whitelist so a DTO can be
 * produced without a second query and without over-fetching password material.
 */

import { type Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";

export const postAuthorSelect = {
  user: { select: { id: true, name: true, username: true, image: true } },
  group: { select: { id: true, slug: true, name: true, privacy: true, deletedAt: true } },
  media: {
    orderBy: { position: "asc" },
    select: { upload: { select: { id: true, width: true, height: true } } },
  },
  mentions: {
    select: { mentionedUser: { select: { id: true, username: true, name: true, banned: true } } },
  },
  repostOf: {
    select: {
      id: true,
      body: true,
      published: true,
      deletedAt: true,
      createdAt: true,
      user: { select: { id: true, name: true, username: true, image: true } },
      group: { select: { id: true, slug: true, name: true, privacy: true, deletedAt: true } },
      media: { orderBy: { position: "asc" }, select: { upload: { select: { id: true, width: true, height: true } } } },
      mentions: {
        select: { mentionedUser: { select: { id: true, username: true, name: true, banned: true } } },
      },
    },
  },
} satisfies Prisma.PostInclude;

export type PostWithAuthor = Prisma.PostGetPayload<{ include: typeof postAuthorSelect }>;

export interface FindPostsArgs {
  readonly where: Prisma.PostWhereInput;
  readonly orderBy: Prisma.PostOrderByWithRelationInput;
  readonly skip: number;
  readonly take: number;
}

export async function findPosts(args: FindPostsArgs): Promise<PostWithAuthor[]> {
  return prisma.post.findMany({
    where: args.where,
    orderBy: args.orderBy,
    skip: args.skip,
    take: args.take,
    include: postAuthorSelect,
  });
}

export async function countPosts(where: Prisma.PostWhereInput): Promise<number> {
  return prisma.post.count({ where });
}

export async function findPostById(id: string): Promise<PostWithAuthor | null> {
  return prisma.post.findUnique({ where: { id }, include: postAuthorSelect });
}

export async function createPost(data: Prisma.PostUncheckedCreateInput): Promise<PostWithAuthor> {
  return prisma.post.create({ data, include: postAuthorSelect });
}

export async function updatePost(
  id: string,
  data: Prisma.PostUncheckedUpdateInput,
): Promise<PostWithAuthor> {
  return prisma.post.update({ where: { id }, data, include: postAuthorSelect });
}

/** Soft delete: the row survives so a moderation action stays auditable. */
export async function softDeletePost(id: string, at: Date): Promise<PostWithAuthor> {
  return prisma.post.update({
    where: { id },
    data: { deletedAt: at },
    include: postAuthorSelect,
  });
}

export async function restorePost(id: string): Promise<PostWithAuthor> {
  return prisma.post.update({
    where: { id },
    data: { deletedAt: null },
    include: postAuthorSelect,
  });
}

/** Aggregate counts for the dashboard, in one round trip. */
export async function countPostsByUser(userId: string): Promise<{
  total: number;
  published: number;
  drafts: number;
}> {
  const [total, published] = await Promise.all([
    prisma.post.count({ where: { userId, deletedAt: null } }),
    prisma.post.count({ where: { userId, deletedAt: null, published: true } }),
  ]);

  return { total, published, drafts: total - published };
}

/**
 * Keyset page of the public feed: newest first, `(createdAt, id)` as the
 * cursor so inserts at the head never shift or duplicate rows across pages.
 */
export async function findFeedPage(args: {
  readonly where: Prisma.PostWhereInput;
  readonly cursor: { createdAt: Date; id: string } | null;
  readonly take: number;
}): Promise<PostWithAuthor[]> {
  const after: Prisma.PostWhereInput | undefined = args.cursor
    ? {
        OR: [
          { createdAt: { lt: args.cursor.createdAt } },
          { createdAt: args.cursor.createdAt, id: { lt: args.cursor.id } },
        ],
      }
    : undefined;

  return prisma.post.findMany({
    where: after ? { AND: [args.where, after] } : args.where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: args.take,
    include: postAuthorSelect,
  });
}

/** Create a post with its images in one transaction. */
export async function createPostWithMedia(
  data: Prisma.PostUncheckedCreateInput,
  mediaIds: readonly string[],
): Promise<PostWithAuthor> {
  return prisma.$transaction(async (tx) => {
    const post = await tx.post.create({ data, select: { id: true } });
    if (data.repostOfId) {
      await tx.post.update({ where: { id: data.repostOfId }, data: { shareCount: { increment: 1 } } });
    }
    if (mediaIds.length > 0) {
      await tx.postMedia.createMany({
        data: mediaIds.map((uploadId, position) => ({ postId: post.id, uploadId, position })),
      });
    }
    return tx.post.findUniqueOrThrow({ where: { id: post.id }, include: postAuthorSelect });
  });
}

/** Replace a post's image set (order = array order). */
export async function replacePostMedia(postId: string, mediaIds: readonly string[]): Promise<void> {
  await prisma.$transaction([
    prisma.postMedia.deleteMany({ where: { postId, uploadId: { notIn: [...mediaIds] } } }),
    ...mediaIds.map((uploadId, position) =>
      prisma.postMedia.upsert({
        where: { uploadId },
        create: { postId, uploadId, position },
        update: { position },
      }),
    ),
  ]);
}

export async function currentMediaIds(postId: string): Promise<string[]> {
  const rows = await prisma.postMedia.findMany({ where: { postId }, select: { uploadId: true } });
  return rows.map((row) => row.uploadId);
}

/** A share was removed: its original loses one from its counter (never below 0). */
export async function decrementShareCount(postId: string): Promise<void> {
  await prisma.post.updateMany({ where: { id: postId, shareCount: { gt: 0 } }, data: { shareCount: { decrement: 1 } } });
}
