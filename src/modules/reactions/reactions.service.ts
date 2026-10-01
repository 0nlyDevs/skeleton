/**
 * Post reactions.
 *
 * One reaction per user per post (a unique index, not a check-then-write), a
 * counter maintained in the same transaction, and a live push of the new totals
 * to the post's thread and to the public feed.
 */

import { RATE_LIMITS, enforceThenRecord, rateLimitKey } from "@/lib/rate-limit";
import type { AuthUser, ReactionType } from "@/types";

import { notifyInBackground, notifyPostReaction } from "../notifications/notifications.service";
import { broadcastEngagement, getEngagement } from "../posts/posts.engagement";
import type { PostEngagementDto } from "../posts/posts.dto";
import { isPublicPost, loadInteractivePost, loadReadablePost } from "../posts/posts.service";
import { deleteReaction, findReactors, upsertReaction } from "./reactions.repository";

export interface ReactionResult {
  readonly engagement: PostEngagementDto | null;
  readonly viewerReaction: ReactionType | null;
}

export async function reactToPost(
  postId: string,
  type: ReactionType,
  actor: AuthUser,
): Promise<ReactionResult> {
  const post = await loadInteractivePost(postId, actor);

  await enforceThenRecord([{ key: rateLimitKey("reaction", actor.id), rule: RATE_LIMITS.reaction }]);

  const change = await upsertReaction({ postId, userId: actor.id, type });

  // Only the first reaction notifies: switching 👍 to ❤️ is not news.
  if (change === "created" && post.userId !== actor.id) {
    notifyInBackground(
      notifyPostReaction({ userId: post.userId, actor, postId, postTitle: post.title }),
      { postId },
    );
  }

  const engagement =
    change === "unchanged" ? await getEngagement(postId) : await broadcastEngagement(postId, isPublicPost(post));

  return { engagement, viewerReaction: type };
}

export async function removeReaction(postId: string, actor: AuthUser): Promise<ReactionResult> {
  const post = await loadReadablePost(postId, actor);
  const removed = await deleteReaction(postId, actor.id);

  const engagement = removed
    ? await broadcastEngagement(postId, isPublicPost(post))
    : await getEngagement(postId);

  return { engagement, viewerReaction: null };
}

export interface ReactorDto {
  readonly type: ReactionType;
  readonly user: { id: string; name: string; username: string | null; image: string | null };
}

/** Who reacted, newest first; same visibility as the post itself. */
export async function listReactors(postId: string, viewer: AuthUser | null): Promise<ReactorDto[]> {
  await loadReadablePost(postId, viewer);
  const rows = await findReactors(postId, 100);
  return rows.map((row) => ({ type: row.type as ReactionType, user: row.user }));
}
