import type { MessageKey } from "@/lib/i18n";
import { REACTION_TYPES, type ReactionCounts, type ReactionType } from "@/types";

export const REACTION_EMOJI: Record<ReactionType, string> = {
  LIKE: "👍",
  LOVE: "❤️",
  HAHA: "😂",
  WOW: "😮",
  SAD: "😢",
  ANGRY: "😡",
};

export const REACTION_LABEL: Record<ReactionType, MessageKey> = {
  LIKE: "reactions.LIKE",
  LOVE: "reactions.LOVE",
  HAHA: "reactions.HAHA",
  WOW: "reactions.WOW",
  SAD: "reactions.SAD",
  ANGRY: "reactions.ANGRY",
};

/** The three most used reactions on a post, for the compact summary. */
export function topReactions(counts: ReactionCounts, limit = 3): ReactionType[] {
  return REACTION_TYPES.filter((type) => (counts[type] ?? 0) > 0)
    .sort((left, right) => (counts[right] ?? 0) - (counts[left] ?? 0))
    .slice(0, limit);
}

/**
 * Apply the viewer's change locally so the bar answers on click; the server's
 * engagement payload then replaces these numbers with the authoritative ones.
 */
export function applyReactionChange(
  counts: ReactionCounts,
  total: number,
  previous: ReactionType | null,
  next: ReactionType | null,
): { counts: ReactionCounts; total: number } {
  const updated: ReactionCounts = { ...counts };
  let nextTotal = total;
  if (previous) {
    updated[previous] = Math.max(0, (updated[previous] ?? 0) - 1);
    nextTotal -= 1;
  }
  if (next) {
    updated[next] = (updated[next] ?? 0) + 1;
    nextTotal += 1;
  }
  return { counts: updated, total: Math.max(0, nextTotal) };
}
