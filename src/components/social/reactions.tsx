import { Angry, Frown, Heart, Laugh, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import type { MessageKey } from "@/lib/i18n";
import { REACTION_TYPES, type ReactionCounts, type ReactionType } from "@/types";

/** The logo's bubble: a ring with its glint. "Utile" is a bubble given. */
function BubbleGlyph({ className }: { readonly className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden focusable="false">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M7.6 10.2a5 5 0 0 1 3-2.6" />
    </svg>
  );
}

const ICONS: Record<ReactionType, (props: { className?: string | undefined }) => ReactNode> = {
  LIKE: ({ className }) => <BubbleGlyph {...(className ? { className } : {})} />,
  LOVE: ({ className }) => <Heart className={className} aria-hidden />,
  HAHA: ({ className }) => <Laugh className={className} aria-hidden />,
  WOW: ({ className }) => <Sparkles className={className} aria-hidden />,
  SAD: ({ className }) => <Frown className={className} aria-hidden />,
  ANGRY: ({ className }) => <Angry className={className} aria-hidden />,
};

/** A reaction as an icon, never an emoji: it follows the text colour and the theme. */
export function ReactionIcon({ type, className = "size-[1.125rem]" }: { readonly type: ReactionType; readonly className?: string }) {
  return ICONS[type]({ className });
}

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
