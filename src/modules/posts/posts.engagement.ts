/**
 * Engagement (comment and reaction counters) for posts.
 *
 * Shared by the comments and reactions modules: whichever one changed a
 * counter calls `broadcastEngagement`, so every open feed card and thread
 * updates from the same payload.
 */

import { logger } from "@/lib/logger";
import { publishEngagement } from "@/lib/socket/emit";
import type { ReactionCounts } from "@/types";

import { toPollDto } from "../polls/polls.dto";
import { findPollByPost } from "../polls/polls.repository";
import { countReactionsByType, findPostCounters } from "../reactions/reactions.repository";
import type { PostEngagementDto } from "./posts.dto";

export async function getEngagement(postId: string): Promise<PostEngagementDto | null> {
  const [counters, byType, poll] = await Promise.all([
    findPostCounters(postId),
    countReactionsByType([postId]),
    findPollByPost(postId),
  ]);
  if (!counters) return null;

  return {
    postId,
    commentCount: counters.commentCount,
    reactionCount: counters.reactionCount,
    shareCount: counters.shareCount,
    reactions: byType.get(postId) ?? ({} as ReactionCounts),
    poll: poll ? toPollDto(poll) : null,
  };
}

/** Recompute and push. Best-effort: a failed push never fails the write. */
export async function broadcastEngagement(
  postId: string,
  /** Feed rooms that show this post (see `postAudience`); the thread is implied. */
  audience: readonly string[],
): Promise<PostEngagementDto | null> {
  try {
    const engagement = await getEngagement(postId);
    if (engagement) publishEngagement(engagement, audience);
    return engagement;
  } catch (error) {
    logger.warn("engagement broadcast failed", { postId, error });
    return null;
  }
}
