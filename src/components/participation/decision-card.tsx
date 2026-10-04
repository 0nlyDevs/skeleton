"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useI18n } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { formatDateTime } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { DecisionDto } from "@/modules/participation/participation.service";

/**
 * F65 — a decision put to the vote: the question, the options, one ballot per
 * resident with a receipt. Results appear when the vote closes.
 */
export function DecisionCard({ decision, signedIn }: { readonly decision: DecisionDto; readonly signedIn: boolean }) {
  const { t, locale } = useI18n();
  const [current, setCurrent] = useState(decision);
  const [choice, setChoice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const voted = current.receipt !== null;

  const vote = async () => {
    if (!choice) return;
    setBusy(true);
    try {
      const { data } = await apiFetch<{ data: DecisionDto }>(`/api/decisions/${current.slug}/vote`, { method: "POST", body: { optionId: choice } });
      setCurrent(data);
      toast.success(t("tn.participate.vote_done"));
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(false);
    }
  };

  const topVotes = Math.max(1, ...current.options.map((option) => option.votes ?? 0));

  return (
    <article id={current.slug} className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-panel">
      <header className="flex flex-col gap-2">
        <Badge variant={current.state === "OPEN" ? "primary" : "neutral"} className="w-fit">
          <span className="state-bubble" data-fill={current.state === "OPEN" ? "half" : current.state === "CLOSED" ? "closed" : "ring"} aria-hidden />
          {t(`tn.participate.vote_state.${current.state}` as MessageKey)}
        </Badge>
        <h3 className="text-xl font-semibold">{current.question}</h3>
        <p className="text-[0.9375rem] text-muted-foreground">{current.description}</p>
        <p className="text-[0.8125rem] text-muted-foreground">
          {t("tn.participate.vote_dates", { from: formatDateTime(current.opensAt, locale), to: formatDateTime(current.closesAt, locale) })}
        </p>
      </header>

      {current.state === "CLOSED" ? (
        <ul className="flex flex-col gap-2" aria-label={t("tn.participate.vote_results")}>
          {current.options.map((option) => (
            <li key={option.id} className="flex flex-col gap-1">
              <span className="flex items-baseline justify-between gap-3 text-sm">
                <span className={cn(option.id === current.myOptionId && "font-semibold")}>
                  {option.label}
                  {option.id === current.myOptionId ? ` · ${t("tn.participate.vote_mine")}` : ""}
                </span>
                <span className="tabular-nums">{t("tn.participate.votes", { count: option.votes ?? 0 })}</span>
              </span>
              <span className="h-2 overflow-hidden rounded-full bg-surface-muted">
                <span className="block h-full rounded-full bg-foreground" style={{ width: `${((option.votes ?? 0) / topVotes) * 100}%` }} />
              </span>
            </li>
          ))}
          <li className="text-[0.8125rem] text-muted-foreground">{t("tn.participate.vote_total", { count: current.total })}</li>
        </ul>
      ) : voted ? (
        <div role="status" className="flex flex-col gap-1 rounded-2xl bg-success/10 p-4">
          <p className="flex items-center gap-2 font-semibold text-success">
            <CheckCircle2 className="size-4" aria-hidden />
            {t("tn.participate.vote_done")}
          </p>
          <p className="text-sm">{t("tn.participate.vote_receipt", { receipt: current.receipt ?? "" })}</p>
          <p className="text-[0.8125rem] text-muted-foreground">{t("tn.participate.vote_results_later")}</p>
        </div>
      ) : current.state === "UPCOMING" ? (
        <p className="rounded-xl bg-surface-muted px-3 py-2 text-sm">{t("tn.participate.vote_upcoming")}</p>
      ) : !signedIn ? (
        <p className="text-sm">{t("tn.participate.sign_in")}</p>
      ) : (
        <>
          <div role="radiogroup" aria-label={current.question} className="flex flex-col gap-2">
            {current.options.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={choice === option.id}
                onClick={() => setChoice(option.id)}
                className={cn("flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-[0.9375rem] font-medium", choice === option.id ? "bg-foreground text-background" : "bg-surface-muted hover:bg-accent")}
              >
                <span aria-hidden className="state-bubble" data-fill={choice === option.id ? "full" : "ring"} />
                {option.label}
              </button>
            ))}
          </div>
          <Button type="button" className="self-start" disabled={!choice || busy} onClick={() => void vote()}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {t("tn.participate.vote_send")}
          </Button>
          <p className="text-[0.8125rem] text-muted-foreground">{t("tn.participate.vote_once")}</p>
        </>
      )}
    </article>
  );
}
