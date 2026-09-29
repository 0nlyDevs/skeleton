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

import type { Prisma } from "@prisma/client";

import { assertOwnerOrStaff, isStaff } from "@/lib/auth/guards";
import { NotFoundError } from "@/lib/errors";
import { paginate, resolveSortField, toPagination, type Paginated } from "@/lib/pagination";
import type { AuthUser } from "@/types";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";
import { toPostDto, toPostDtos, type PostDto } from "./posts.dto";
import {
  countPosts,
  countPostsByUser,
  createPost,
  findPostById,
  findPosts,
  restorePost,
  softDeletePost,
  updatePost,
} from "./posts.repository";
import type {
  CreatePostInput,
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

  return toPostDto(row);
}

export async function updatePostForActor(
  id: string,
  input: UpdatePostInput,
  actor: ActorContext,
): Promise<PostDto> {
  const _existing = assertOwnerOrStaff(await findPostById(id), actor.user);

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

  return toPostDto(row);
}

export async function deletePostForActor(id: string, actor: ActorContext): Promise<void> {
  const existing = assertOwnerOrStaff(await findPostById(id), actor.user);
  await softDeletePost(existing.id, new Date());

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
