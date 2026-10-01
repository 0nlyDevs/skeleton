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

import { countReactionsByType, findPostCounters } from "../reactions/reactions.repository";
import type { PostEngagementDto } from "./posts.dto";

export async function getEngagement(postId: string): Promise<PostEngagementDto | null> {
  const [counters, byType] = await Promise.all([
    findPostCounters(postId),
    countReactionsByType([postId]),
  ]);
  if (!counters) return null;

  return {
    postId,
    commentCount: counters.commentCount,
    reactionCount: counters.reactionCount,
    reactions: byType.get(postId) ?? ({} as ReactionCounts),
  };
}

/** Recompute and push. Best-effort: a failed push never fails the write. */
export async function broadcastEngagement(
  postId: string,
  isPublic: boolean,
): Promise<PostEngagementDto | null> {
  try {
    const engagement = await getEngagement(postId);
    if (engagement) publishEngagement(engagement, isPublic);
    return engagement;
  } catch (error) {
    logger.warn("engagement broadcast failed", { postId, error });
    return null;
  }
}
