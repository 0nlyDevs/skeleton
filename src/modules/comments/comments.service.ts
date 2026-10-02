/**
 * Comments.
 *
 * Rules:
 *   * Read access is the post's read access (`loadReadablePost`); writing needs
 *     a live, published post.
 *   * Only the author edits their words. The author or staff may remove a
 *     comment; a staff removal is audited and the author is told.
 *   * Every change is pushed to the post's open threads and the counters to
 *     every feed card, so nobody has to refresh.
 */

import { isStaff } from "@/lib/auth/guards";
import { findStaffRoles, type GroupStaffRole } from "../groups/groups.repository";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import { RATE_LIMITS, enforceThenRecord, rateLimitKey } from "@/lib/rate-limit";
import { publishComment } from "@/lib/socket/emit";
import type { AuthUser } from "@/types";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";
import {
  notifyCommentReply,
  notifyContentMention,
  notifyInBackground,
  notifyModeration,
  notifyPostComment,
} from "../notifications/notifications.service";
import { broadcastEngagement } from "../posts/posts.engagement";
import { loadInteractivePost, loadReadablePost, mentionAudience, postAudience } from "../posts/posts.service";
import { resolveMentions, syncCommentMentions } from "../mentions/mentions.service";
import { toCommentDto, type CommentDto } from "./comments.dto";
import {
  findCommentById,
  findRepliesFor,
  findTopLevelComments,
  insertComment,
  softDeleteComment,
  updateCommentBody,
  type CommentRow,
} from "./comments.repository";
import type { CreateCommentInput, ListCommentsQuery, UpdateCommentInput } from "./comments.schema";

export interface ActorContext {
  readonly user: AuthUser;
  readonly ip?: string;
}

export interface CommentPage {
  readonly data: CommentDto[];
  readonly nextCursor: string | null;
}

function encodeCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`, "utf8").toString("base64url");
}

function decodeCursor(cursor: string | undefined): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  const createdAt = new Date(iso ?? "");
  if (!id || Number.isNaN(createdAt.getTime())) throw new BadRequestError("Invalid cursor.");
  return { createdAt, id };
}

/** One page of threads with their replies: two queries, whatever the size. */
export async function listComments(
  postId: string,
  query: ListCommentsQuery,
  viewer: AuthUser | null,
): Promise<CommentPage> {
  const post = await loadReadablePost(postId, viewer);

  const rows = await findTopLevelComments({
    postId,
    after: decodeCursor(query.cursor),
    take: query.limit + 1,
  });
  const page = rows.slice(0, query.limit);
  const replies = await findRepliesFor(page.map((row) => row.id));
  const roles = await staffRolesFor(post.groupId, [...page, ...replies].map((row) => row.user.id));

  const byParent = new Map<string, CommentDto[]>();
  for (const reply of replies) {
    const list = byParent.get(reply.parentId ?? "") ?? [];
    list.push(toCommentDto(reply, [], roles));
    byParent.set(reply.parentId ?? "", list);
  }

  const last = page[page.length - 1];
  return {
    data: page.map((row) => toCommentDto(row, byParent.get(row.id) ?? [], roles)),
    nextCursor: rows.length > query.limit && last ? encodeCursor(last) : null,
  };
}

/** Staff roles of comment authors in the post's group, by user id. */
async function staffRolesFor(groupId: string | null, userIds: readonly string[]): Promise<Map<string, GroupStaffRole>> {
  if (!groupId) return new Map();
  const keyed = await findStaffRoles([groupId], userIds);
  return new Map([...keyed].map(([key, role]) => [key.slice(groupId.length + 1), role]));
}

async function resolveParent(postId: string, parentId: string | undefined): Promise<CommentRow | null> {
  if (!parentId) return null;
  const parent = await findCommentById(parentId);
  if (!parent || parent.postId !== postId || parent.deletedAt) {
    throw new NotFoundError("The comment you are replying to no longer exists.");
  }
  // Threads are one level deep: a reply to a reply joins the same thread.
  if (parent.parentId) {
    const root = await findCommentById(parent.parentId);
    return root ?? parent;
  }
  return parent;
}

export async function createComment(
  postId: string,
  input: CreateCommentInput,
  actor: ActorContext,
): Promise<CommentDto> {
  const post = await loadInteractivePost(postId, actor.user);

  await enforceThenRecord([{ key: rateLimitKey("comment", actor.user.id), rule: RATE_LIMITS.comment }]);

  const parent = await resolveParent(postId, input.parentId);
  const replyTarget = input.parentId ? await findCommentById(input.parentId) : null;

  const inserted = await insertComment({
    postId,
    userId: actor.user.id,
    parentId: parent?.id ?? null,
    body: input.body,
  });
  const mentioned = await resolveMentions(input.body, actor.user.id, mentionAudience(post.groupId));
  await syncCommentMentions(inserted.id, actor.user.id, mentioned);
  const row = (await findCommentById(inserted.id)) ?? inserted;
  const comment = toCommentDto(row, [], await staffRolesFor(post.groupId, [actor.user.id]));

  publishComment({ kind: "created", postId, comment });
  void broadcastEngagement(postId, postAudience(post));

  // One bell entry per person: a direct reply beats a comment-on-your-post,
  // which beats a mention.
  const notified = new Set<string>([actor.user.id]);
  const replyTo = replyTarget && !replyTarget.deletedAt ? replyTarget.userId : null;
  if (replyTo && !notified.has(replyTo)) {
    notified.add(replyTo);
    notifyInBackground(
      notifyCommentReply({ userId: replyTo, actor: actor.user, postId, preview: input.body }),
      { postId },
    );
  }
  if (!notified.has(post.userId)) {
    notified.add(post.userId);
    notifyInBackground(
      notifyPostComment({
        userId: post.userId,
        actor: actor.user,
        postId,
        postTitle: post.title,
        preview: input.body,
      }),
      { postId },
    );
  }

  for (const userId of mentioned) {
    if (notified.has(userId)) continue;
    notified.add(userId);
    notifyInBackground(
      notifyContentMention({ userId, actor: actor.user, postId, preview: input.body }),
      { postId },
    );
  }

  return comment;
}

export async function editComment(
  id: string,
  input: UpdateCommentInput,
  actor: ActorContext,
): Promise<CommentDto> {
  const existing = await findCommentById(id);
  // Not-yours is not-found: editing someone else's words is never allowed,
  // not even for staff (they remove, they do not rewrite).
  if (!existing || existing.deletedAt || existing.userId !== actor.user.id) throw new NotFoundError();

  const post = await loadReadablePost(existing.postId, actor.user);
  await updateCommentBody(id, input.body);
  const mentioned = await resolveMentions(input.body, actor.user.id, mentionAudience(post.groupId));
  const fresh = await syncCommentMentions(id, actor.user.id, mentioned);
  for (const userId of fresh) {
    notifyInBackground(
      notifyContentMention({ userId, actor: actor.user, postId: post.id, preview: input.body }),
      { commentId: id },
    );
  }

  const row = (await findCommentById(id)) ?? existing;
  const comment = toCommentDto(row, [], await staffRolesFor(post.groupId, [actor.user.id]));
  publishComment({ kind: "updated", postId: row.postId, comment });
  return comment;
}

export async function deleteComment(id: string, actor: ActorContext): Promise<void> {
  const existing = await findCommentById(id);
  if (!existing || existing.deletedAt) throw new NotFoundError();

  const isAuthor = existing.userId === actor.user.id;
  if (!isAuthor && !isStaff(actor.user)) throw new NotFoundError();

  const post = await loadReadablePost(existing.postId, actor.user);
  const row = await softDeleteComment(id, existing.postId);

  publishComment({ kind: "deleted", postId: row.postId, comment: toCommentDto(row) });
  void broadcastEngagement(row.postId, postAudience(post));

  if (!isAuthor) {
    await recordAudit({
      actorId: actor.user.id,
      action: auditActions.commentDeleted,
      targetType: "comment",
      targetId: id,
      metadata: { postId: row.postId, authorId: existing.userId },
      ip: actor.ip ?? null,
    });
    notifyInBackground(notifyModeration({ userId: existing.userId, what: "comment" }), { commentId: id });
  }
}

/** Moderation entry point used when resolving a report on a comment. */
export async function removeCommentAsStaff(id: string, actor: ActorContext, reason: string | null): Promise<void> {
  if (!isStaff(actor.user)) throw new NotFoundError();
  const existing = await findCommentById(id);
  if (!existing || existing.deletedAt) return;

  const post = await loadReadablePost(existing.postId, actor.user);
  const row = await softDeleteComment(id, existing.postId);
  publishComment({ kind: "deleted", postId: row.postId, comment: toCommentDto(row) });
  void broadcastEngagement(row.postId, postAudience(post));
  await recordAudit({
    actorId: actor.user.id,
    action: auditActions.commentDeleted,
    targetType: "comment",
    targetId: id,
    metadata: { postId: row.postId, authorId: existing.userId, source: "moderation_report" },
    ip: actor.ip ?? null,
  });
  notifyInBackground(
    notifyModeration({ userId: existing.userId, what: "comment", reason }),
    { commentId: id },
  );
}
