"use client";

import { SmilePlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiFetch, ApiRequestError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { REACTION_TYPES, type ReactionCounts, type ReactionType } from "@/types";
import type { PostEngagementDto } from "@/modules/posts/posts.dto";

import { REACTION_EMOJI, REACTION_LABEL, applyReactionChange, topReactions } from "./reactions";

export interface ReactionState {
  readonly reactions: ReactionCounts;
  readonly reactionCount: number;
  readonly viewerReaction: ReactionType | null;
}

/**
 * Reaction picker + summary. Optimistic: the click shows immediately, the PUT
 * confirms, and a failure rolls back. Guests see the totals and a sign-in link.
 */
export function ReactionBar({
  postId,
  state,
  onChange,
  signedIn,
}: {
  readonly postId: string;
  readonly state: ReactionState;
  readonly onChange: (next: ReactionState) => void;
  readonly signedIn: boolean;
}) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const top = topReactions(state.reactions);

  const choose = async (type: ReactionType | null) => {
    if (busy) return;
    setOpen(false);
    const previous = state;
    const local = applyReactionChange(state.reactions, state.reactionCount, state.viewerReaction, type);
    onChange({ reactions: local.counts, reactionCount: local.total, viewerReaction: type });
    setBusy(true);

    try {
      const response = await apiFetch<{ data: { engagement: PostEngagementDto | null; viewerReaction: ReactionType | null } }>(
        `/api/posts/${encodeURIComponent(postId)}/reactions`,
        type ? { method: "PUT", body: { type } } : { method: "DELETE" },
      );
      const engagement = response.data.engagement;
      if (engagement) {
        onChange({
          reactions: engagement.reactions,
          reactionCount: engagement.reactionCount,
          viewerReaction: response.data.viewerReaction,
        });
      }
    } catch (caught) {
      onChange(previous);
      toast.error(
        caught instanceof ApiRequestError && caught.isRateLimited ? t("auth.login.too_many") : t("feedback.error.body"),
      );
    } finally {
      setBusy(false);
    }
  };

  const summary =
    state.reactionCount > 0 ? (
      <span className="flex items-center gap-1 text-[12.5px] text-muted-foreground">
        <span aria-hidden className="flex -space-x-1">
          {top.map((type) => (
            <span key={type}>{REACTION_EMOJI[type]}</span>
          ))}
        </span>
        {t("feed.reactions_count", { count: state.reactionCount })}
      </span>
    ) : null;

  if (!signedIn) {
    return (
      <div className="flex items-center gap-3">
        {summary}
        <Link href="/login" className="text-[12.5px] font-medium text-primary hover:underline">
          {t("reactions.react")}
        </Link>
      </div>
    );
  }

  const mine = state.viewerReaction;

  return (
    <div className="flex items-center gap-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={busy}
            aria-label={mine ? t(REACTION_LABEL[mine]) : t("reactions.react")}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors",
              mine
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-surface-muted hover:text-foreground",
            )}
          >
            {mine ? <span aria-hidden>{REACTION_EMOJI[mine]}</span> : <SmilePlus className="size-4" />}
            {mine ? t(REACTION_LABEL[mine]) : t("reactions.react")}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-1.5" align="start">
          <div className="flex items-center gap-0.5" role="group" aria-label={t("reactions.react")}>
            {REACTION_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => void choose(type === mine ? null : type)}
                title={t(REACTION_LABEL[type])}
                aria-label={t(REACTION_LABEL[type])}
                aria-pressed={type === mine}
                className={cn(
                  "flex size-9 items-center justify-center rounded-full text-[20px] transition-transform hover:scale-125 focus-visible:scale-125 focus-visible:outline-none",
                  type === mine && "bg-primary/15",
                )}
              >
                {REACTION_EMOJI[type]}
              </button>
            ))}
          </div>
          {mine ? (
            <button
              type="button"
              onClick={() => void choose(null)}
              className="mt-1 w-full rounded-md px-2 py-1 text-[12px] text-muted-foreground hover:bg-surface-muted"
            >
              {t("reactions.remove")}
            </button>
          ) : null}
        </PopoverContent>
      </Popover>
      {summary}
    </div>
  );
}
