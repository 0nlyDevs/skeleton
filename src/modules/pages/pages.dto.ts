import { pageBlocksSchema, type PageBlock } from "./pages.schema";
import type { PageRow } from "./pages.repository";

export interface PageImageDto {
  readonly id: string;
  readonly url: string;
  readonly width: number | null;
  readonly height: number | null;
}

export interface PageSummaryDto {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly tagline: string | null;
  readonly theme: string;
  readonly cover: PageImageDto | null;
  readonly visibility: "PUBLIC" | "UNLISTED";
  readonly published: boolean;
  readonly viewCount: number;
  readonly likeCount: number;
  readonly author: { readonly id: string; readonly name: string; readonly username: string | null; readonly image: string | null };
  readonly updatedAt: string;
  readonly createdAt: string;
}

export interface PageDto extends PageSummaryDto {
  readonly font: string;
  readonly blocks: PageBlock[];
  /** Dimensions of every image the blocks use, keyed by upload id (no layout shift). */
  readonly images: Record<string, PageImageDto>;
  readonly viewerLiked: boolean;
  readonly viewerIsOwner: boolean;
  readonly viewerCanModerate: boolean;
}

function image(upload: { id: string; width: number | null; height: number | null }): PageImageDto {
  return { id: upload.id, url: `/api/files/${upload.id}`, width: upload.width, height: upload.height };
}

export function toPageSummaryDto(row: PageRow): PageSummaryDto {
  const cover = row.coverId ? row.media.find((entry) => entry.upload.id === row.coverId)?.upload : undefined;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    tagline: row.tagline,
    theme: row.theme,
    cover: cover ? image(cover) : null,
    visibility: row.visibility,
    published: row.published,
    viewCount: row.viewCount,
    likeCount: row.likeCount,
    author: { id: row.user.id, name: row.user.name, username: row.user.username, image: row.user.image },
    updatedAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export function toPageDto(
  row: PageRow,
  viewer: { liked: boolean; isOwner: boolean; canModerate: boolean },
): PageDto {
  // Stored JSON is re-validated on the way out: a row edited by hand can
  // never smuggle an unexpected shape into the renderer.
  const parsed = pageBlocksSchema.safeParse(row.blocks);
  return {
    ...toPageSummaryDto(row),
    font: row.font,
    blocks: parsed.success ? parsed.data : [],
    images: Object.fromEntries(row.media.map(({ upload }) => [upload.id, image(upload)])),
    viewerLiked: viewer.liked,
    viewerIsOwner: viewer.isOwner,
    viewerCanModerate: viewer.canModerate,
  };
}
