/**
 * Post business rules.
 *
 * Three rules define this module, and every future entity copies them:
 *
 *  1. **Visibility is computed server-side.** A draft is visible to its author
 *     and to staff; to everyone else it does not exist.
 *  2. **Not-yours is not-found.** `assertOwnerOrStaff` raises 404 for another
 *     user's private post, so the API cannot be used to test whether an id
 *     exists.
 *  3. **Writes are audited.** Create, update, delete and restore each leave a
 *     trail entry carrying the changed field names — never the content itself.
 */

import type { Prisma } from "@/generated/prisma/client";

import { assertOwnerOrStaff, isStaff } from "@/lib/auth/guards";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { publishFeedPost } from "@/lib/socket/emit";
import { paginate, resolveSortField, toPagination, type Paginated } from "@/lib/pagination";
import type { AuthUser } from "@/types";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";
import { countReactionsByType, findViewerReactions } from "../reactions/reactions.repository";
import { toFeedItemDto, toPostDto, toPostDtos, type FeedItemDto, type PostDto } from "./posts.dto";
import {
  countPosts,
  countPostsByUser,
  createPost,
  findFeedPage,
  findPostById,
  findPosts,
  restorePost,
  softDeletePost,
  updatePost,
  type PostWithAuthor,
} from "./posts.repository";
import type {
  CreatePostInput,
  FeedQuery,
  ListPostsQuery,
  UpdatePostInput,
} from "./posts.schema";

const SORTABLE_FIELDS = ["createdAt", "updatedAt", "title"] as const;

export interface ActorContext {
  readonly user: AuthUser;
  readonly ip?: string;
}

function buildVisibilityFilter(actor: AuthUser): Prisma.PostWhereInput {
  if (isStaff(actor)) return {};
  return { OR: [{ published: true }, { userId: actor.id }] };
}

function buildWhere(query: ListPostsQuery, actor: AuthUser): Prisma.PostWhereInput {
  const staff = isStaff(actor);

  const conditions: Prisma.PostWhereInput[] = [buildVisibilityFilter(actor)];

  // Soft-deleted rows are hidden from everyone unless staff explicitly asks.
  if (!(staff && query.includeDeleted)) {
    conditions.push({ deletedAt: null });
  }

  if (query.mine) {
    conditions.push({ userId: actor.id });
  } else if (query.authorId) {
    conditions.push({ userId: query.authorId });
  }

  if (query.published !== undefined) {
    conditions.push({ published: query.published });
  }

  if (query.q) {
    conditions.push({
      OR: [
        { title: { contains: query.q } },
        { body: { contains: query.q } },
      ],
    });
  }

  return conditions.length === 1 ? (conditions[0] as Prisma.PostWhereInput) : { AND: conditions };
}

export async function listPosts(
  query: ListPostsQuery,
  actor: AuthUser,
): Promise<Paginated<PostDto>> {
  const where = buildWhere(query, actor);
  const pagination = toPagination(query);
  const sortField = resolveSortField(query.sort, SORTABLE_FIELDS, "createdAt");

  const [rows, total] = await Promise.all([
    findPosts({
      where,
      orderBy: { [sortField]: query.order },
      skip: pagination.skip,
      take: pagination.take,
    }),
    countPosts(where),
  ]);

  return paginate(toPostDtos(rows), {
    page: pagination.page,
    limit: pagination.limit,
    total,
  });
}

/**
 * Load a post the caller is allowed to see, or raise 404.
 *
 * `assertOwnerOrStaff` short-circuits ownership for staff; the draft rule is
 * applied first because it is about visibility, not ownership.
 */
export async function getPostForActor(id: string, actor: AuthUser): Promise<PostDto> {
  const row = await findPostById(id);
  if (!row) throw new NotFoundError();

  if (row.deletedAt && !isStaff(actor)) throw new NotFoundError();
  if (!row.published && !isStaff(actor) && row.userId !== actor.id) throw new NotFoundError();

  return toPostDto(row);
}

/**
 * Load a post `viewer` may read (guests: published only), or raise 404.
 * The single visibility rule shared by pages, comments, reactions and sockets.
 */
export async function loadReadablePost(id: string, viewer: AuthUser | null): Promise<PostWithAuthor> {
  const row = await findPostById(id);
  if (!row) throw new NotFoundError();

  const staff = viewer !== null && isStaff(viewer);
  if (row.deletedAt && !staff) throw new NotFoundError();
  if (!row.published && !staff && row.userId !== viewer?.id) throw new NotFoundError();

  return row;
}

/** Interaction (comment, react) requires a live, published post. */
export async function loadInteractivePost(id: string, viewer: AuthUser): Promise<PostWithAuthor> {
  const row = await loadReadablePost(id, viewer);
  if (!row.published || row.deletedAt) {
    throw new BadRequestError("This post is not open for interaction.");
  }
  return row;
}

export function isPublicPost(row: { published: boolean; deletedAt: Date | null }): boolean {
  return row.published && row.deletedAt === null;
}

async function toFeedItems(rows: PostWithAuthor[], viewer: AuthUser | null): Promise<FeedItemDto[]> {
  const ids = rows.map((row) => row.id);
  const [counts, mine] = await Promise.all([
    countReactionsByType(ids),
    viewer ? findViewerReactions(ids, viewer.id) : Promise.resolve(new Map<string, never>()),
  ]);
  return rows.map((row) => toFeedItemDto(row, counts.get(row.id) ?? {}, mine.get(row.id) ?? null));
}

function encodeCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`, "utf8").toString("base64url");
}

function decodeCursor(cursor: string | undefined): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  try {
    const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    const createdAt = new Date(iso ?? "");
    if (!id || Number.isNaN(createdAt.getTime())) throw new Error("bad cursor");
    return { createdAt, id };
  } catch {
    throw new BadRequestError("Invalid cursor.");
  }
}

export interface FeedPage {
  readonly data: FeedItemDto[];
  /** Pass back as `cursor` for the next page; `null` at the end. */
  readonly nextCursor: string | null;
}

/**
 * The public feed. Keyset-paginated (stable under concurrent inserts, O(page)
 * regardless of depth) and assembled with a fixed three queries per page:
 * posts, reaction breakdown, viewer reactions — never one per post.
 */
export async function listFeed(
  query: FeedQuery,
  viewer: AuthUser | null,
  followingIds?: readonly string[],
): Promise<FeedPage> {
  const conditions: Prisma.PostWhereInput[] = [{ published: true, deletedAt: null }];
  if (query.authorId) conditions.push({ userId: query.authorId });
  if (followingIds) conditions.push({ userId: { in: [...followingIds] } });
  if (query.q) {
    conditions.push({ OR: [{ title: { contains: query.q } }, { body: { contains: query.q } }] });
  }

  const rows = await findFeedPage({
    where: { AND: conditions },
    cursor: decodeCursor(query.cursor),
    take: query.limit + 1,
  });

  const page = rows.slice(0, query.limit);
  const last = page[page.length - 1];

  return {
    data: await toFeedItems(page, viewer),
    nextCursor: rows.length > query.limit && last ? encodeCursor(last) : null,
  };
}

export async function getFeedItem(id: string, viewer: AuthUser | null): Promise<FeedItemDto> {
  const row = await loadReadablePost(id, viewer);
  const [item] = await toFeedItems([row], viewer);
  return item as FeedItemDto;
}

/**
 * Keep every open feed in step with a post's public state. The payload is
 * viewer-neutral (no "you reacted"): it goes to everyone.
 */
async function announce(row: PostWithAuthor, wasPublic: boolean): Promise<void> {
  try {
    const nowPublic = isPublicPost(row);
    if (!wasPublic && !nowPublic) return;

    if (!nowPublic) {
      publishFeedPost({ kind: "deleted", postId: row.id });
      return;
    }

    const [item] = await toFeedItems([row], null);
    publishFeedPost({ kind: wasPublic ? "updated" : "created", postId: row.id, ...(item ? { post: item } : {}) });
  } catch (error) {
    logger.warn("feed announcement failed", { postId: row.id, error });
  }
}

export async function createPostForActor(
  input: CreatePostInput,
  actor: ActorContext,
): Promise<PostDto> {
  const row = await createPost({
    // Ownership comes from the session. There is no path by which a client can
    // choose the author.
    userId: actor.user.id,
    title: input.title,
    body: input.body,
    published: input.published,
    tags: input.tags,
  });

  await recordAudit({
    actorId: actor.user.id,
    action: auditActions.postCreated,
    targetType: "post",
    targetId: row.id,
    metadata: { published: row.published },
    ip: actor.ip ?? null,
  });

  void announce(row, false);

  return toPostDto(row);
}

export async function updatePostForActor(
  id: string,
  input: UpdatePostInput,
  actor: ActorContext,
): Promise<PostDto> {
  const existing = assertOwnerOrStaff(await findPostById(id), actor.user);

  const data: Prisma.PostUncheckedUpdateInput = {};
  const changed: string[] = [];

  if (input.title !== undefined) {
    data.title = input.title;
    changed.push("title");
  }
  if (input.body !== undefined) {
    data.body = input.body;
    changed.push("body");
  }
  if (input.published !== undefined) {
    data.published = input.published;
    changed.push("published");
  }
  if (input.tags !== undefined) {
    data.tags = input.tags;
    changed.push("tags");
  }

  const row = await updatePost(id, data);

  await recordAudit({
    actorId: actor.user.id,
    action: auditActions.postUpdated,
    targetType: "post",
    targetId: row.id,
    // Field names, not field values: an audit trail should not become a second
    // copy of the data it is auditing.
    metadata: { changed },
    ip: actor.ip ?? null,
  });

  void announce(row, isPublicPost(existing));

  return toPostDto(row);
}

export async function deletePostForActor(id: string, actor: ActorContext): Promise<void> {
  const existing = assertOwnerOrStaff(await findPostById(id), actor.user);
  const deleted = await softDeletePost(existing.id, new Date());
  void announce(deleted, isPublicPost(existing));

  await recordAudit({
    actorId: actor.user.id,
    action: auditActions.postDeleted,
    targetType: "post",
    targetId: existing.id,
    ip: actor.ip ?? null,
  });
}

/** Staff-only: undo a soft delete. */
export async function restorePostForActor(id: string, actor: ActorContext): Promise<PostDto> {
  const existing = await findPostById(id);
  if (!existing) throw new NotFoundError();

  const row = await restorePost(id);
  void announce(row, isPublicPost(existing));

  await recordAudit({
    actorId: actor.user.id,
    action: auditActions.postRestored,
    targetType: "post",
    targetId: row.id,
    ip: actor.ip ?? null,
  });

  return toPostDto(row);
}

export async function getPostStatsForUser(userId: string): Promise<{
  total: number;
  published: number;
  drafts: number;
}> {
  return countPostsByUser(userId);
}
