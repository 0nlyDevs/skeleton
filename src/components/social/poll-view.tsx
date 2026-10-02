"use client";

import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PollDto } from "@/modules/polls/polls.dto";

/**
 * A poll inside a post. Before voting, options are plain choices; after
 * voting (or once closed, or for the author) each shows its share of the
 * voters. Ballots are anonymous: only totals ever reach the browser.
 */
export function PollView({
  postId,
  poll,
  viewerVotes,
  canVote,
  showResults: forceResults,
  onChange,
}: {
  readonly postId: string;
  readonly poll: PollDto;
  readonly viewerVotes: readonly string[];
  readonly canVote: boolean;
  /** The author always sees results. */
  readonly showResults: boolean;
  readonly onChange: (poll: PollDto, viewerVotes: readonly string[]) => void;
}) {
  const t = useTranslation();
    const [draft, setDraft] = useState<readonly string[]>([]);
  const [busy, setBusy] = useState(false);
  const voted = viewerVotes.length > 0;
  const results = voted || poll.closed || forceResults || !canVote;

  const submit = async (optionIds: readonly string[]) => {
    if (busy) return;
    setBusy(true);
    try {
      const response = await apiFetch<{ data: { poll: PollDto; viewerVotes: string[] } }>(`/api/posts/${postId}/poll`, {
        method: optionIds.length > 0 ? "PUT" : "DELETE",
        ...(optionIds.length > 0 ? { body: { optionIds } } : {}),
      });
      setDraft([]);
      onChange(response.data.poll, response.data.viewerVotes);
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(false);
    }
  };

  const pick = (optionId: string) => {
    if (!canVote || poll.closed) return;
    if (!poll.multiple) {
      void submit([optionId]);
      return;
    }
    setDraft((current) => (current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId]));
  };

  const top = Math.max(0, ...poll.options.map((option) => option.votes));

  return (
    <div className="flex flex-col gap-2" onClick={(event) => event.stopPropagation()}>
      <ul className="flex flex-col gap-2" aria-label={t("poll.label")}>
        {poll.options.map((option) => {
          const share = poll.totalVoters > 0 ? Math.round((option.votes / poll.totalVoters) * 100) : 0;
          const mine = viewerVotes.includes(option.id);
          const selected = draft.includes(option.id);
          const winning = results && option.votes > 0 && option.votes === top;
          return (
            <li key={option.id}>
              <button
                type="button"
                disabled={busy || !canVote || poll.closed}
                aria-pressed={poll.multiple ? selected || mine : mine}
                onClick={() => pick(option.id)}
                className={cn(
                  "relative flex min-h-11 w-full items-center gap-2 overflow-hidden rounded-xl border px-3 py-2 text-left text-[14px] transition-colors",
                  "disabled:cursor-default",
                  results ? "border-border/70" : "border-border hover:border-primary hover:bg-primary/5",
                  (selected || mine) && "border-primary",
                )}
              >
                {results ? (
                  <span
                    aria-hidden
                    className={cn("absolute inset-y-0 left-0 rounded-r-lg transition-[width] duration-500", winning ? "bg-primary/20" : "bg-surface-muted")}
                    style={{ width: `${share}%` }}
                  />
                ) : null}
                {poll.multiple && !results ? (
                  <span className={cn("relative grid size-4 shrink-0 place-items-center rounded border", selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50")}>
                    {selected ? <Check className="size-3" /> : null}
                  </span>
                ) : null}
                <span className={cn("relative min-w-0 flex-1 break-words", winning && "font-semibold")}>{option.label}</span>
                {mine ? <Check className="relative size-4 shrink-0 text-primary" aria-label={t("poll.your_vote")} /> : null}
                {results ? <span className="relative shrink-0 tabular-nums text-[13px] font-medium text-muted-foreground">{share}%</span> : null}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted-foreground">
        <span>{t(poll.totalVoters === 1 ? "poll.voters_one" : "poll.voters", { count: poll.totalVoters })}</span>
        <span aria-hidden>·</span>
        <span>
          {poll.closed
            ? t("poll.closed")
            : poll.closesAt
              ? t("poll.closes", { when: formatRelative(poll.closesAt) })
              : t("poll.open")}
        </span>
        {poll.multiple ? (
          <>
            <span aria-hidden>·</span>
            <span>{t("poll.multiple_hint")}</span>
          </>
        ) : null}
        {voted && canVote && !poll.closed ? (
          <button type="button" className="ml-auto font-semibold hover:underline" disabled={busy} onClick={() => void submit([])}>
            {t("poll.retract")}
          </button>
        ) : null}
        {!canVote && !poll.closed ? <span className="ml-auto">{t("poll.sign_in_to_vote")}</span> : null}
      </div>

      {poll.multiple && !voted && canVote && !poll.closed ? (
        <Button
          type="button"
          size="sm"
          className="self-start"
          disabled={busy}
          onClick={() => (draft.length > 0 ? void submit(draft) : toast(t("poll.pick_first")))}
        >
          {busy ? <Loader2 className="animate-spin" /> : null}
          {t("poll.vote")}
        </Button>
      ) : null}
    </div>
  );
}
