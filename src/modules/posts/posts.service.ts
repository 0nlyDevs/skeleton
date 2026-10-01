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

import { isStaff } from "@/lib/auth/guards";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { RATE_LIMITS, enforceThenRecord, rateLimitKey } from "@/lib/rate-limit";
import { publishFeedPost } from "@/lib/socket/emit";
import { FEED_ROOM, groupRoom } from "@/lib/socket/rooms";
import { paginate, resolveSortField, toPagination, type Paginated } from "@/lib/pagination";
import type { AuthUser } from "@/types";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";
import { resolveGroupAccess, type GroupAccess } from "../groups/groups.access";
import { findActiveGroupIds, findGroupById, findMembership, findMemberships } from "../groups/groups.repository";
import { loadGroup } from "../groups/groups.service";
import { resolveMentions, syncPostMentions } from "../mentions/mentions.service";
import {
  notifyContentMention,
  notifyInBackground,
  notifyModeration,
} from "../notifications/notifications.service";
import { countReactionsByType, findViewerReactions } from "../reactions/reactions.repository";
import { findAttachableImages } from "../uploads/uploads.repository";
import { toFeedItemDto, toPostDto, toPostDtos, type FeedItemDto, type PostDto } from "./posts.dto";
import {
  countPosts,
  countPostsByUser,
  createPostWithMedia,
  currentMediaIds,
  findFeedPage,
  findPostById,
  findPosts,
  replacePostMedia,
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

/** The group a post lives in, with the viewer's access to it (or `null`). */
async function groupAccessForPost(row: PostWithAuthor, viewer: AuthUser | null): Promise<GroupAccess | null> {
  if (!row.group) return null;
  const membership = viewer ? await findMembership(row.group.id, viewer.id) : null;
  return resolveGroupAccess(row.group, viewer, membership);
}

/**
 * Load a post `viewer` may read, or raise 404. The single visibility rule
 * shared by pages, comments, reactions, file access, AI tools and sockets:
 *   * drafts: author and platform staff only;
 *   * removed posts: platform staff only;
 *   * group posts: whoever may read the group (private ⇒ members).
 */
export async function loadReadablePost(id: string, viewer: AuthUser | null): Promise<PostWithAuthor> {
  const row = await findPostById(id);
  if (!row) throw new NotFoundError();

  const staff = viewer !== null && isStaff(viewer);
  if (row.deletedAt && !staff) throw new NotFoundError();
  if (!row.published && !staff && row.userId !== viewer?.id) throw new NotFoundError();

  if (row.group) {
    const access = await groupAccessForPost(row, viewer);
    if (!access?.canRead) throw new NotFoundError();
  }

  return row;
}

/**
 * Interaction (comment, react) requires a live, published post — and, in a
 * group, active membership: outsiders may read a public group but not speak
 * in it.
 */
export async function loadInteractivePost(id: string, viewer: AuthUser): Promise<PostWithAuthor> {
  const row = await loadReadablePost(id, viewer);
  if (!row.published || row.deletedAt) {
    throw new BadRequestError("This post is not open for interaction.");
  }
  if (row.group) {
    const access = await groupAccessForPost(row, viewer);
    if (!access?.canPost) throw new ForbiddenError("Join the group to interact with its posts.");
  }
  return row;
}

/** True when the post is live and visible in some feed. */
export function isPublicPost(row: { published: boolean; deletedAt: Date | null }): boolean {
  return row.published && row.deletedAt === null;
}

/**
 * Feed rooms allowed to receive live updates about this post: the public feed
 * for a timeline post, the group's room for a group post, nothing for a draft
 * or a removed post.
 */
export function postAudience(row: { published: boolean; deletedAt: Date | null; groupId: string | null }): string[] {
  if (!isPublicPost(row)) return [];
  return row.groupId ? [groupRoom(row.groupId)] : [FEED_ROOM];
}

async function toFeedItems(rows: PostWithAuthor[], viewer: AuthUser | null): Promise<FeedItemDto[]> {
  const ids = rows.map((row) => row.id);
  const groupIds = [...new Set(rows.map((row) => row.groupId).filter((id): id is string => id !== null))];
  const [counts, mine, memberships] = await Promise.all([
    countReactionsByType(ids),
    viewer ? findViewerReactions(ids, viewer.id) : Promise.resolve(new Map<string, never>()),
    viewer ? findMemberships(viewer.id, groupIds) : Promise.resolve(new Map()),
  ]);

  return rows.map((row) => {
    const staff = viewer !== null && isStaff(viewer);
    const groupModerator =
      row.group !== null && resolveGroupAccess(row.group, viewer, memberships.get(row.group.id) ?? null).canModerate;
    return toFeedItemDto(row, counts.get(row.id) ?? {}, mine.get(row.id) ?? null, staff || groupModerator);
  });
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
 * The feed. Keyset-paginated (stable under concurrent inserts, O(page)
 * regardless of depth) and assembled with a fixed handful of queries per page,
 * never one per post.
 *
 *   * home (`all`): timeline posts + posts of the viewer's groups;
 *   * `following`: the same, narrowed to accounts the viewer follows;
 *   * `groupSlug`: one group, after its access check;
 *   * `authorId`: a profile timeline — the author's timeline posts plus their
 *     posts in public groups or groups the viewer belongs to.
 */
export async function listFeed(
  query: FeedQuery,
  viewer: AuthUser | null,
  followingIds?: readonly string[],
): Promise<FeedPage> {
  const conditions: Prisma.PostWhereInput[] = [{ published: true, deletedAt: null }];
  const myGroups = viewer ? await findActiveGroupIds(viewer.id) : [];

  if (query.groupSlug) {
    const { group, access } = await loadGroup(query.groupSlug, viewer);
    if (!access.canRead) throw new NotFoundError("This group does not exist.");
    conditions.push({ groupId: group.id });
  } else if (query.authorId) {
    conditions.push({ userId: query.authorId });
    conditions.push({
      OR: [
        { groupId: null },
        { group: { privacy: "PUBLIC", deletedAt: null } },
        ...(myGroups.length > 0 ? [{ groupId: { in: myGroups } }] : []),
      ],
    });
  } else {
    conditions.push({
      OR: [{ groupId: null }, ...(myGroups.length > 0 ? [{ groupId: { in: myGroups } }] : [])],
    });
  }

  if (followingIds) conditions.push({ userId: { in: [...followingIds, ...(viewer ? [viewer.id] : [])] } });
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
 * Keep every open feed in step with a post's state. The payload is
 * viewer-neutral (no "you reacted", no moderator flag): it goes to everyone in
 * the audience rooms, which are recomputed before and after the change so a
 * post that leaves a feed is removed from it.
 */
async function announce(row: PostWithAuthor, before: string[]): Promise<void> {
  try {
    const after = postAudience(row);
    const removedFrom = before.filter((room) => !after.includes(room));
    if (removedFrom.length > 0) publishFeedPost({ kind: "deleted", postId: row.id }, removedFrom);
    if (after.length === 0) return;

    const [item] = await toFeedItems([row], null);
    if (!item) return;
    const kind = before.length > 0 ? "updated" : "created";
    publishFeedPost({ kind, postId: row.id, post: item }, after);
  } catch (error) {
    logger.warn("feed announcement failed", { postId: row.id, error });
  }
}

/** First line of the text, for lists and search, when no title is given. */
function deriveTitle(body: string, fallback: string): string {
  const firstLine = body.split("\n").map((line) => line.trim()).find((line) => line.length > 0);
  if (!firstLine) return fallback;
  return firstLine.length > 120 ? `${firstLine.slice(0, 117)}…` : firstLine;
}

async function assertAttachable(mediaIds: readonly string[], userId: string, keep: readonly string[] = []): Promise<void> {
  const fresh = mediaIds.filter((id) => !keep.includes(id));
  if (fresh.length === 0) return;
  const owned = await findAttachableImages(userId, fresh);
  if (owned.length !== fresh.length) {
    throw new BadRequestError("One of the images is unavailable. Upload it again.");
  }
}

/** Who may receive a mention from this post: only people able to read it. */
export function mentionAudience(groupId: string | null): ((ids: string[]) => Promise<Set<string>>) | undefined {
  if (!groupId) return undefined;
  return async (ids) => {
    const group = await findGroupById(groupId);
    if (!group) return new Set();
    if (group.privacy === "PUBLIC") return new Set(ids);
    const allowed = new Set<string>();
    for (const id of ids) {
      if ((await findMembership(groupId, id))?.status === "ACTIVE") allowed.add(id);
    }
    return allowed;
  };
}

function notifyNewMentions(userIds: readonly string[], actor: AuthUser, postId: string, preview: string): void {
  for (const userId of userIds) {
    notifyInBackground(notifyContentMention({ userId, actor, postId, preview }), { postId });
  }
}

export async function createPostForActor(input: CreatePostInput, actor: ActorContext): Promise<FeedItemDto> {
  await enforceThenRecord([{ key: rateLimitKey("post:create", actor.user.id), rule: RATE_LIMITS.postCreate }]);

  if (input.groupId) {
    const group = await findGroupById(input.groupId);
    if (!group || group.deletedAt) throw new NotFoundError("This group does not exist.");
    const access = resolveGroupAccess(group, actor.user, await findMembership(group.id, actor.user.id));
    if (!access.canPost) throw new ForbiddenError("Join the group to post in it.");
  }

  await assertAttachable(input.mediaIds, actor.user.id);

  const row = await createPostWithMedia(
    {
      // Ownership comes from the session. There is no path by which a client
      // can choose the author.
      userId: actor.user.id,
      title: input.title ?? deriveTitle(input.body, "Photo"),
      body: input.body,
      published: input.published,
      tags: input.tags,
      groupId: input.groupId ?? null,
    },
    input.mediaIds,
  );

  const mentioned = await resolveMentions(input.body, actor.user.id, mentionAudience(row.groupId));
  const fresh = await syncPostMentions(row.id, actor.user.id, mentioned);
  if (row.published) notifyNewMentions(fresh, actor.user, row.id, input.body);

  await recordAudit({
    actorId: actor.user.id,
    action: auditActions.postCreated,
    targetType: "post",
    targetId: row.id,
    metadata: { published: row.published, images: input.mediaIds.length, groupId: row.groupId },
    ip: actor.ip ?? null,
  });

  const saved = (await findPostById(row.id)) ?? row;
  void announce(saved, []);

  const [item] = await toFeedItems([saved], actor.user);
  return item as FeedItemDto;
}

/** Only the author edits a post's content; moderators remove, never rewrite. */
export async function updatePostForActor(
  id: string,
  input: UpdatePostInput,
  actor: ActorContext,
): Promise<FeedItemDto> {
  const existing = await findPostById(id);
  if (!existing || existing.deletedAt || existing.userId !== actor.user.id) throw new NotFoundError();
  const before = postAudience(existing);

  const data: Prisma.PostUncheckedUpdateInput = {};
  const changed: string[] = [];

  if (input.title !== undefined) {
    data.title = input.title;
    changed.push("title");
  }
  if (input.body !== undefined && input.body !== existing.body) {
    data.body = input.body;
    if (input.title === undefined && existing.title === deriveTitle(existing.body, "Photo")) {
      data.title = deriveTitle(input.body, "Photo");
    }
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
  if (input.mediaIds !== undefined) {
    const current = await currentMediaIds(id);
    await assertAttachable(input.mediaIds, actor.user.id, current);
    await replacePostMedia(id, input.mediaIds);
    changed.push("media");
  }

  const nextBody = input.body ?? existing.body;
  if (nextBody.trim().length === 0 && (input.mediaIds ?? (await currentMediaIds(id))).length === 0) {
    throw new BadRequestError("A post needs text or an image.");
  }
  // "Edited" marks a change readers can see, after the post went live.
  if (existing.published && (changed.includes("body") || changed.includes("media"))) data.editedAt = new Date();

  const row = Object.keys(data).length > 0 ? await updatePost(id, data) : ((await findPostById(id)) ?? existing);

  if (changed.includes("body")) {
    const mentioned = await resolveMentions(nextBody, actor.user.id, mentionAudience(row.groupId));
    const fresh = await syncPostMentions(row.id, actor.user.id, mentioned);
    if (row.published) notifyNewMentions(fresh, actor.user, row.id, nextBody);
  }

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

  const saved = (await findPostById(row.id)) ?? row;
  void announce(saved, before);

  const [item] = await toFeedItems([saved], actor.user);
  return item as FeedItemDto;
}

/**
 * Remove a post: its author, platform staff, or a moderator of the group it
 * was posted in. A removal by someone else is audited and the author told.
 */
export async function deletePostForActor(id: string, actor: ActorContext, reason?: string | null): Promise<void> {
  const existing = await findPostById(id);
  if (!existing || existing.deletedAt) throw new NotFoundError();

  const isAuthor = existing.userId === actor.user.id;
  const groupAccess = await groupAccessForPost(existing, actor.user);
  const mayModerate = isStaff(actor.user) || groupAccess?.canModerate === true;
  if (!isAuthor && !mayModerate) throw new NotFoundError();
  if (!isAuthor && existing.group && !groupAccess?.canRead) throw new NotFoundError();

  const before = postAudience(existing);
  const deleted = await softDeletePost(existing.id, new Date());
  void announce(deleted, before);

  await recordAudit({
    actorId: actor.user.id,
    action: isAuthor ? auditActions.postDeleted : auditActions.postModerated,
    targetType: "post",
    targetId: existing.id,
    metadata: isAuthor ? undefined : { authorId: existing.userId, groupId: existing.groupId, reason: reason ?? null },
    ip: actor.ip ?? null,
  });

  if (!isAuthor) {
    notifyInBackground(notifyModeration({ userId: existing.userId, what: "publication", reason: reason ?? null }), {
      postId: id,
    });
  }
}

/** Staff-only: undo a soft delete. */
export async function restorePostForActor(id: string, actor: ActorContext): Promise<PostDto> {
  const existing = await findPostById(id);
  if (!existing) throw new NotFoundError();

  const row = await restorePost(id);
  void announce(row, postAudience(existing));

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
