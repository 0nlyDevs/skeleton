"use client";

import { ThumbsUp } from "lucide-react";
import Link from "@/components/ui/link";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import type { PostEngagementDto } from "@/modules/posts/posts.dto";
import { REACTION_TYPES, type ReactionCounts, type ReactionType } from "@/types";

import { REACTION_EMOJI, REACTION_LABEL, applyReactionChange, topReactions } from "./reactions";
import { ReactorsDialog, type Reactor } from "./reactors-dialog";

export interface ReactionState {
  readonly reactions: ReactionCounts;
  readonly reactionCount: number;
  readonly viewerReaction: ReactionType | null;
}

/** "👍❤️ 12" — the compact summary shown above a post's action bar. */
/** Compact summary; a click lists who reacted with what. */
export function ReactionSummary({ state, postId }: { readonly state: ReactionState; readonly postId: string }) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const load = useCallback(async () => {
    const response = await apiFetch<{ data: { type: ReactionType; user: Reactor["user"] }[] }>(`/api/posts/${encodeURIComponent(postId)}/reactions`);
    return response.data.map((row) => ({ emoji: REACTION_EMOJI[row.type], user: row.user }));
  }, [postId]);
  if (state.reactionCount === 0) return <span />;
  return (
    <>
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        setOpen(true);
      }}
      aria-label={t("reactors.open", { count: state.reactionCount })}
      className="flex items-center gap-1.5 rounded-full text-[0.8125rem] text-muted-foreground hover:underline"
    >
      <span aria-hidden className="flex -space-x-1 text-[0.9375rem]">
        {topReactions(state.reactions).map((type) => (
          <span key={type} className="grid size-5 place-items-center rounded-full bg-surface ring-2 ring-card">
            {REACTION_EMOJI[type]}
          </span>
        ))}
      </span>
      <span className="tabular-nums">{state.reactionCount}</span>
    </button>
    <ReactorsDialog open={open} onOpenChange={setOpen} load={load} />
    </>
  );
}

/**
 * The "Like" action: a click likes (or removes your reaction), a hover/long
 * press opens the six reactions. Optimistic, rolled back on failure; the
 * server's counters replace the local guess.
 */
export function ReactionButton({
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
  const busy = useRef(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mine = state.viewerReaction;

  const choose = async (type: ReactionType | null) => {
    if (busy.current) return;
    setOpen(false);
    const previous = state;
    const local = applyReactionChange(state.reactions, state.reactionCount, state.viewerReaction, type);
    onChange({ reactions: local.counts, reactionCount: local.total, viewerReaction: type });
    busy.current = true;
    try {
      const response = await apiFetch<{ data: { engagement: PostEngagementDto | null; viewerReaction: ReactionType | null } }>(
        `/api/posts/${encodeURIComponent(postId)}/reactions`,
        type ? { method: "PUT", body: { type } } : { method: "DELETE" },
      );
      const engagement = response.data.engagement;
      if (engagement) {
        onChange({ reactions: engagement.reactions, reactionCount: engagement.reactionCount, viewerReaction: response.data.viewerReaction });
      }
    } catch (error) {
      onChange(previous);
      toast.error(describeApiError(error, t));
    } finally {
      busy.current = false;
    }
  };

  const label = mine ? t(REACTION_LABEL[mine]) : t("reactions.LIKE");
  const classes = cn(
    "flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-[0.8438rem] font-semibold transition-colors hover:bg-surface-muted",
    mine ? "text-primary" : "text-muted-foreground",
  );

  if (!signedIn) {
    return (
      <Link href="/login" className={classes}>
        <ThumbsUp className="size-[18px]" aria-hidden />
        {t("reactions.LIKE")}
      </Link>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={classes}
          aria-label={label}
          aria-pressed={mine !== null}
          onClick={(event) => {
            event.preventDefault();
            void choose(mine ? null : "LIKE");
          }}
          onMouseEnter={() => {
            hoverTimer.current = setTimeout(() => setOpen(true), 450);
          }}
          onMouseLeave={() => {
            if (hoverTimer.current) clearTimeout(hoverTimer.current);
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
            }
          }}
        >
          {mine ? <span aria-hidden className="text-[1.125rem] leading-none">{REACTION_EMOJI[mine]}</span> : <ThumbsUp className="size-[18px]" aria-hidden />}
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-auto rounded-full p-1.5" onMouseLeave={() => setOpen(false)}>
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
                "grid size-10 place-items-center rounded-full text-[1.375rem] transition-transform duration-150 hover:-translate-y-1 hover:scale-125 focus-visible:scale-125 focus-visible:outline-none motion-reduce:transition-none",
                type === mine && "bg-primary/15",
              )}
            >
              {REACTION_EMOJI[type]}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
