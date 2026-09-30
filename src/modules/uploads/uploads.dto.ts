/**
 * Upload response shapes.
 *
 * The only field a client truly needs is `url`: every stored file is reachable
 * at `/api/files/<id>`, which is also the shape `users.schema.ts` accepts back
 * as an avatar. The rest of the DTO exists so an admin surface can render a
 * file list without a second query.
 */

import type { Upload, UploadVisibility } from "@/generated/prisma/client";

export interface UploadDto {
  readonly id: string;
  /** Authorised path, safe to embed: `/api/files/<id>`. */
  readonly url: string;
  readonly originalName: string;
  readonly mime: string;
  readonly size: number;
  readonly visibility: UploadVisibility;
  readonly createdAt: string;
}

export function toUploadDto(row: Upload): UploadDto {
  return {
    id: row.id,
    url: `/api/files/${row.id}`,
    originalName: row.originalName,
    mime: row.mime,
    size: row.size,
    visibility: row.visibility,
    createdAt: row.createdAt.toISOString(),
  };
}
