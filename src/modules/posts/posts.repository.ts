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
  user: { select: { id: true, name: true, image: true } },
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
