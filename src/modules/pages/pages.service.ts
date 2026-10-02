/**
 * Pages: user-built public pages.
 *
 * Rules, all enforced here:
 *   - only the owner edits; the owner or platform staff delete;
 *   - a draft (unpublished) or removed page answers 404 to everyone but its
 *     owner and staff, so its existence never leaks;
 *   - every image must be an upload the owner made and that is not attached to
 *     anything else; attaching ties the file's visibility to the page;
 *   - views are counted once per visitor and page every six hours.
 */

import { randomInt } from "node:crypto";

import { isStaff } from "@/lib/auth/guards";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError, RateLimitedError } from "@/lib/errors";
import { RATE_LIMITS, enforceThenRecord, rateLimitKey } from "@/lib/rate-limit";
import { slugify } from "@/lib/utils";
import type { AuthUser } from "@/types";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";
import { notifyInBackground, notifyModeration } from "../notifications/notifications.service";
import { toPageDto, toPageSummaryDto, type PageDto, type PageSummaryDto } from "./pages.dto";
import {
  createPageWithMedia,
  findLikedPageIds,
  findPageById,
  findPageBySlug,
  findPages,
  findUsableImages,
  hasLikedPage,
  incrementPageViews,
  isPageSlugTaken,
  setPageLike,
  updatePageWithMedia,
  type PageRow,
} from "./pages.repository";
import { blockImageIds, slugSchema, type CreatePageInput, type ListPagesQuery, type PageBlock, type UpdatePageInput } from "./pages.schema";

export interface PageActor {
  readonly user: AuthUser;
  readonly ip?: string;
}

function isReadable(row: PageRow, viewer: AuthUser | null): boolean {
  if (viewer && (row.userId === viewer.id || isStaff(viewer))) return true;
  return row.published && row.deletedAt === null && !row.user.banned;
}

async function loadReadable(slug: string, viewer: AuthUser | null): Promise<PageRow> {
  const row = await findPageBySlug(slug);
  if (!row || !isReadable(row, viewer)) throw new NotFoundError("This page does not exist.");
  return row;
}

async function loadOwned(slug: string, actor: AuthUser): Promise<PageRow> {
  const row = await findPageBySlug(slug);
  if (!row || row.deletedAt) throw new NotFoundError("This page does not exist.");
  if (row.userId !== actor.id) {
    // A draft stays invisible: strangers get the same 404 as for a missing page.
    if (!isReadable(row, actor)) throw new NotFoundError("This page does not exist.");
    throw new ForbiddenError("Only the author can edit this page.");
  }
  return row;
}

async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title).slice(0, 48);
  const candidate = slugSchema.safeParse(base);
  if (candidate.success && !(await isPageSlugTaken(candidate.data))) return candidate.data;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const next = `${base || "page"}-${randomInt(1000, 99999)}`;
    if (slugSchema.safeParse(next).success && !(await isPageSlugTaken(next))) return next;
  }
  return `page-${randomInt(10 ** 7, 10 ** 8)}`;
}

/** Every image the page will use, after checking the owner may attach each one. */
async function resolveImages(userId: string, blocks: readonly PageBlock[], coverId: string | null, pageId: string | null): Promise<string[]> {
  const ids = [...new Set([...(coverId ? [coverId] : []), ...blockImageIds(blocks)])];
  const usable = new Set(await findUsableImages(userId, ids, pageId));
  if (ids.some((id) => !usable.has(id))) throw new BadRequestError("One of the images is unavailable. Upload it again.");
  return ids;
}

function viewerFlags(row: PageRow, viewer: AuthUser | null, liked: boolean) {
  return { liked, isOwner: viewer?.id === row.userId, canModerate: viewer !== null && isStaff(viewer) };
}

export async function createPage(input: CreatePageInput, actor: PageActor): Promise<PageDto> {
  await enforceThenRecord([{ key: rateLimitKey("page:create", actor.user.id), rule: RATE_LIMITS.pageCreate }]);

  let slug: string;
  if (input.slug) {
    if (await isPageSlugTaken(input.slug)) throw new ConflictError("This address is already taken.");
    slug = input.slug;
  } else {
    slug = await uniqueSlug(input.title);
  }
  const coverId = input.coverId ?? null;
  const images = await resolveImages(actor.user.id, input.blocks, coverId, null);

  const row = await createPageWithMedia(
    {
      slug,
      userId: actor.user.id,
      title: input.title,
      tagline: input.tagline || null,
      theme: input.theme,
      font: input.font,
      coverId,
      blocks: input.blocks,
      visibility: input.visibility,
      published: input.published,
    },
    images,
  );

  await recordAudit({
    actorId: actor.user.id,
    action: auditActions.pageCreated,
    targetType: "page",
    targetId: row.id,
    metadata: { published: row.published, blocks: input.blocks.length },
    ip: actor.ip ?? null,
  });
  return toPageDto(row, viewerFlags(row, actor.user, false));
}

export async function updatePage(slug: string, input: UpdatePageInput, actor: PageActor): Promise<PageDto> {
  const row = await loadOwned(slug, actor.user);
  await enforceThenRecord([{ key: rateLimitKey("page:update", actor.user.id), rule: RATE_LIMITS.pageUpdate }]);

  if (input.slug && input.slug !== row.slug && (await isPageSlugTaken(input.slug))) {
    throw new ConflictError("This address is already taken.");
  }

  const touchesImages = input.blocks !== undefined || input.coverId !== undefined;
  const images = touchesImages
    ? await resolveImages(
        actor.user.id,
        input.blocks ?? (toPageDto(row, viewerFlags(row, actor.user, false)).blocks),
        input.coverId !== undefined ? input.coverId : row.coverId,
        row.id,
      )
    : null;

  const updated = await updatePageWithMedia(
    row.id,
    {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.tagline !== undefined ? { tagline: input.tagline || null } : {}),
      ...(input.theme !== undefined ? { theme: input.theme } : {}),
      ...(input.font !== undefined ? { font: input.font } : {}),
      ...(input.coverId !== undefined ? { coverId: input.coverId } : {}),
      ...(input.blocks !== undefined ? { blocks: input.blocks } : {}),
      ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
      ...(input.published !== undefined ? { published: input.published } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
    },
    images,
  );

  await recordAudit({
    actorId: actor.user.id,
    action: auditActions.pageUpdated,
    targetType: "page",
    targetId: row.id,
    metadata: { changed: Object.keys(input) },
    ip: actor.ip ?? null,
  });
  return toPageDto(updated, viewerFlags(updated, actor.user, await hasLikedPage(updated.id, actor.user.id)));
}

export async function deletePage(slug: string, actor: PageActor, reason?: string | null): Promise<void> {
  const row = await findPageBySlug(slug);
  if (!row || row.deletedAt || !isReadable(row, actor.user)) throw new NotFoundError("This page does not exist.");
  const owner = row.userId === actor.user.id;
  if (!owner && !isStaff(actor.user)) throw new ForbiddenError("Only the author can delete this page.");

  await updatePageWithMedia(row.id, { deletedAt: new Date(), published: false }, null);
  await recordAudit({
    actorId: actor.user.id,
    action: auditActions.pageDeleted,
    targetType: "page",
    targetId: row.id,
    metadata: { byStaff: !owner },
    ip: actor.ip ?? null,
  });
  if (!owner) {
    notifyInBackground(notifyModeration({ userId: row.userId, what: "page", reason: reason ?? null }), { pageId: row.id });
  }
}

/** Read a page; counts a view for visitors other than the author. */
export async function getPage(slug: string, viewer: AuthUser | null, visitorKey: string | null): Promise<PageDto> {
  const row = await loadReadable(slug, viewer);
  let views = row.viewCount;
  if (row.published && viewer?.id !== row.userId && visitorKey) {
    try {
      await enforceThenRecord([{ key: rateLimitKey("page:view", `${row.id}:${visitorKey}`), rule: RATE_LIMITS.pageView }]);
      await incrementPageViews(row.id);
      views += 1;
    } catch (error) {
      if (!(error instanceof RateLimitedError)) throw error;
    }
  }
  const liked = viewer ? await hasLikedPage(row.id, viewer.id) : false;
  return { ...toPageDto(row, viewerFlags(row, viewer, liked)), viewCount: views };
}

export async function getPageForEditing(slug: string, actor: AuthUser): Promise<PageDto> {
  const row = await loadOwned(slug, actor);
  return toPageDto(row, viewerFlags(row, actor, await hasLikedPage(row.id, actor.id)));
}

export interface PageList {
  readonly data: (PageSummaryDto & { readonly viewerLiked: boolean })[];
  readonly total: number;
  readonly page: number;
  readonly pageCount: number;
}

export async function listPages(query: ListPagesQuery, viewer: AuthUser | null): Promise<PageList> {
  if (query.scope === "mine" && !viewer) return { data: [], total: 0, page: 1, pageCount: 0 };
  const where =
    query.scope === "mine" && viewer
      ? { userId: viewer.id, deletedAt: null }
      : { published: true, visibility: "PUBLIC" as const, deletedAt: null, user: { banned: false } };
  const search = query.q ? { OR: [{ title: { contains: query.q } }, { tagline: { contains: query.q } }] } : {};
  const { rows, total } = await findPages({
    where: { ...where, ...search },
    orderBy: query.scope === "mine" ? [{ updatedAt: "desc" }] : query.sort === "popular" ? [{ likeCount: "desc" }, { viewCount: "desc" }] : [{ createdAt: "desc" }],
    skip: (query.page - 1) * query.limit,
    take: query.limit,
  });
  const liked = viewer ? await findLikedPageIds(rows.map((row) => row.id), viewer.id) : new Set<string>();
  return {
    data: rows.map((row) => ({ ...toPageSummaryDto(row), viewerLiked: liked.has(row.id) })),
    total,
    page: query.page,
    pageCount: Math.ceil(total / query.limit),
  };
}

export async function likePage(slug: string, liked: boolean, actor: AuthUser): Promise<{ liked: boolean; likeCount: number }> {
  const row = await loadReadable(slug, actor);
  if (!row.published || row.deletedAt) throw new BadRequestError("This page is not published.");
  await enforceThenRecord([{ key: rateLimitKey("page:like", actor.id), rule: RATE_LIMITS.reaction }]);
  return { liked, likeCount: await setPageLike(row.id, actor.id, liked) };
}

/** Reports point at a page id; returns the page when the reporter may read it. */
export async function loadReportablePage(id: string, viewer: AuthUser): Promise<PageRow> {
  const row = await findPageById(id);
  if (!row || !row.published || row.deletedAt || !isReadable(row, viewer)) throw new NotFoundError("This page does not exist.");
  return row;
}

export async function removePageAsStaff(id: string, actor: PageActor, note: string | null): Promise<void> {
  const row = await findPageById(id);
  if (!row || row.deletedAt) return;
  await deletePage(row.slug, actor, note);
}

/** For the QR code and share links: the page must be readable by the caller. */
export async function pageUrl(slug: string, viewer: AuthUser | null, origin: string): Promise<string> {
  const row = await loadReadable(slug, viewer);
  return `${origin}/p/${encodeURIComponent(row.slug)}`;
}
