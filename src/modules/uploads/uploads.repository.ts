/**
 * Upload persistence.
 *
 * This layer knows Prisma and nothing else: no authorization, no disk, no HTTP.
 * The disk itself is handled by `@/lib/storage` in the service — the row is
 * only the index that maps an authorised URL back to a stored filename.
 */

import { type Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";

export async function createUpload(
  data: Prisma.UploadUncheckedCreateInput,
): Promise<Prisma.UploadModel> {
  return prisma.upload.create({ data });
}

export async function findUploadById(id: string): Promise<Prisma.UploadModel | null> {
  return prisma.upload.findUnique({ where: { id } });
}

/**
 * What an upload is attached to, for authorisation: a post (visible to whoever
 * may read the post) or a message (visible to the conversation's members).
 */
export async function findUploadAttachment(id: string) {
  return prisma.upload.findUnique({
    where: { id },
    select: {
      postMedia: { select: { postId: true } },
      message: { select: { roomId: true, deletedAt: true } },
      pageMedia: {
        select: { page: { select: { userId: true, published: true, deletedAt: true, user: { select: { banned: true } } } } },
      },
    },
  });
}

/** Uploads the user owns and that are not yet attached to anything. */
export async function findAttachableImages(userId: string, ids: readonly string[]) {
  if (ids.length === 0) return [];
  return prisma.upload.findMany({
    where: {
      id: { in: [...ids] },
      userId,
      mime: { startsWith: "image/" },
      postMedia: null,
      message: null,
      pageMedia: null,
    },
    select: { id: true },
  });
}
