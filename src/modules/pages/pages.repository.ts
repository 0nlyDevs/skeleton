/** Page persistence: Prisma only, no rules. */

import { type Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";

export const pageInclude = {
  user: { select: { id: true, name: true, username: true, image: true, banned: true } },
  media: { select: { upload: { select: { id: true, width: true, height: true } } } },
} satisfies Prisma.PageInclude;

export type PageRow = Prisma.PageGetPayload<{ include: typeof pageInclude }>;

export async function findPageBySlug(slug: string): Promise<PageRow | null> {
  return prisma.page.findUnique({ where: { slug }, include: pageInclude });
}

export async function findPageById(id: string): Promise<PageRow | null> {
  return prisma.page.findUnique({ where: { id }, include: pageInclude });
}

export async function isPageSlugTaken(slug: string): Promise<boolean> {
  return (await prisma.page.count({ where: { slug } })) > 0;
}

export async function findPages(args: {
  where: Prisma.PageWhereInput;
  orderBy: Prisma.PageOrderByWithRelationInput[];
  skip: number;
  take: number;
}): Promise<{ rows: PageRow[]; total: number }> {
  const [rows, total] = await Promise.all([
    prisma.page.findMany({ ...args, include: pageInclude }),
    prisma.page.count({ where: args.where }),
  ]);
  return { rows, total };
}

/** Uploads the user owns, are images, and are free — or already on this page. */
export async function findUsableImages(userId: string, ids: readonly string[], pageId: string | null): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.upload.findMany({
    where: {
      id: { in: [...ids] },
      userId,
      mime: { startsWith: "image/" },
      postMedia: null,
      message: null,
      OR: [{ pageMedia: null }, ...(pageId ? [{ pageMedia: { pageId } }] : [])],
    },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

export async function createPageWithMedia(data: Prisma.PageUncheckedCreateInput, imageIds: readonly string[]): Promise<PageRow> {
  return prisma.$transaction(async (tx) => {
    const page = await tx.page.create({ data, select: { id: true } });
    if (imageIds.length > 0) {
      await tx.pageMedia.createMany({ data: imageIds.map((uploadId) => ({ pageId: page.id, uploadId })) });
    }
    return tx.page.findUniqueOrThrow({ where: { id: page.id }, include: pageInclude });
  });
}

/** Update a page and make its media rows match `imageIds` exactly. */
export async function updatePageWithMedia(
  id: string,
  data: Prisma.PageUncheckedUpdateInput,
  imageIds: readonly string[] | null,
): Promise<PageRow> {
  return prisma.$transaction(async (tx) => {
    await tx.page.update({ where: { id }, data, select: { id: true } });
    if (imageIds) {
      await tx.pageMedia.deleteMany({ where: { pageId: id, uploadId: { notIn: [...imageIds] } } });
      if (imageIds.length > 0) {
        await tx.pageMedia.createMany({ data: imageIds.map((uploadId) => ({ pageId: id, uploadId })), skipDuplicates: true });
      }
    }
    return tx.page.findUniqueOrThrow({ where: { id }, include: pageInclude });
  });
}

export async function incrementPageViews(id: string): Promise<void> {
  await prisma.page.update({ where: { id }, data: { viewCount: { increment: 1 } }, select: { id: true } });
}

export async function hasLikedPage(pageId: string, userId: string): Promise<boolean> {
  return (await prisma.pageLike.count({ where: { pageId, userId } })) > 0;
}

export async function findLikedPageIds(pageIds: readonly string[], userId: string): Promise<Set<string>> {
  if (pageIds.length === 0) return new Set();
  const rows = await prisma.pageLike.findMany({ where: { userId, pageId: { in: [...pageIds] } }, select: { pageId: true } });
  return new Set(rows.map((row) => row.pageId));
}

/** Toggle a like and recount, in one transaction (idempotent under retries). */
export async function setPageLike(pageId: string, userId: string, liked: boolean): Promise<number> {
  return prisma.$transaction(async (tx) => {
    if (liked) await tx.pageLike.createMany({ data: [{ pageId, userId }], skipDuplicates: true });
    else await tx.pageLike.deleteMany({ where: { pageId, userId } });
    const likeCount = await tx.pageLike.count({ where: { pageId } });
    await tx.page.update({ where: { id: pageId }, data: { likeCount }, select: { id: true } });
    return likeCount;
  });
}
