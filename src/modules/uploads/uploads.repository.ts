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
