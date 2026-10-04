"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useI18n } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { formatLongDate } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { cityZoneLabelKey, type CityZoneId } from "@/modules/alerts/city-zones";
import type { ProjectDto } from "@/modules/participation/participation.service";

const STANCES = ["FOR", "NEUTRAL", "AGAINST"] as const;

/**
 * F67 + F66 — one city project: what, where, when, how much, how far along;
 * then the resident's opinion, and the result so far (totals only).
 */
export function ProjectCard({ project, signedIn }: { readonly project: ProjectDto; readonly signedIn: boolean }) {
  const { t, locale } = useI18n();
  const [current, setCurrent] = useState(project);
  const [stance, setStance] = useState<(typeof STANCES)[number] | null>(project.mine?.stance ?? null);
  const [comment, setComment] = useState(project.mine?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const total = current.opinions.for + current.opinions.against + current.opinions.neutral;

  const send = async () => {
    if (!stance) return;
    setBusy(true);
    try {
      const { data } = await apiFetch<{ data: ProjectDto }>(`/api/projects/${current.slug}/opinion`, { method: "POST", body: { stance, comment: comment.trim() || null } });
      setCurrent(data);
      toast.success(t("tn.participate.opinion_saved"));
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article id={current.slug} className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-panel">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={current.status === "DONE" ? "success" : "neutral"}>
            <span className="state-bubble" data-fill={current.status === "DONE" ? "full" : current.status === "IN_PROGRESS" ? "half" : "ring"} aria-hidden />
            {t(`tn.participate.status.${current.status}` as MessageKey)}
          </Badge>
          {current.zone ? <Badge variant="outline">{t(cityZoneLabelKey(current.zone as CityZoneId))}</Badge> : null}
        </div>
        <h3 className="text-xl font-semibold">{current.title}</h3>
        <p className="text-[0.9375rem] text-muted-foreground">{current.summary}</p>
      </header>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-[0.75rem] text-muted-foreground">{t("tn.participate.budget")}</dt>
          <dd className="font-medium tabular-nums">{current.budget !== null ? t("tn.participate.credits", { amount: current.budget.toLocaleString(locale === "fr" ? "fr-FR" : "en-GB") }) : t("tn.participate.unknown")}</dd>
        </div>
        <div>
          <dt className="text-[0.75rem] text-muted-foreground">{t("tn.participate.when")}</dt>
          <dd className="font-medium">
            {current.startsOn ? formatLongDate(current.startsOn, locale) : t("tn.participate.unknown")}
            {current.endsOn ? ` → ${formatLongDate(current.endsOn, locale)}` : ""}
          </dd>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <dt className="text-[0.75rem] text-muted-foreground">{t("tn.participate.progress")}</dt>
          <dd className="flex items-center gap-2 font-medium">
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-valuenow={current.progress} aria-valuemin={0} aria-valuemax={100}>
              <span className="block h-full rounded-full bg-foreground" style={{ width: `${current.progress}%` }} />
            </span>
            <span className="tabular-nums">{current.progress} %</span>
          </dd>
        </div>
      </dl>

      <details className="group">
        <summary className="w-fit cursor-pointer rounded-full bg-surface-muted px-4 py-2 text-sm font-medium hover:bg-accent">{t("tn.participate.read_more")}</summary>
        <p className="prose-body mt-3 text-[0.9375rem]">{current.body}</p>
      </details>

      <section aria-label={t("tn.participate.opinion_title")} className="flex flex-col gap-3 border-t border-border/60 pt-4">
        <h4 className="font-semibold">{t("tn.participate.opinion_title")}</h4>
        {total > 0 ? (
          <p className="text-[0.8125rem] text-muted-foreground">
            {t("tn.participate.opinion_result", { total, for: current.opinions.for, against: current.opinions.against, neutral: current.opinions.neutral })}
          </p>
        ) : (
          <p className="text-[0.8125rem] text-muted-foreground">{t("tn.participate.opinion_none")}</p>
        )}
        {!current.consultationOpen ? (
          <p className="rounded-xl bg-surface-muted px-3 py-2 text-sm">{t("tn.participate.consultation_closed")}</p>
        ) : !signedIn ? (
          <p className="text-sm">{t("tn.participate.sign_in")}</p>
        ) : (
          <>
            <div role="radiogroup" aria-label={t("tn.participate.opinion_title")} className="flex flex-wrap gap-2">
              {STANCES.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={stance === value}
                  onClick={() => setStance(value)}
                  className={cn("rounded-full px-4 py-2 text-sm font-medium", stance === value ? "bg-foreground text-background" : "bg-surface-muted hover:bg-accent")}
                >
                  {t(`tn.participate.stance.${value}` as MessageKey)}
                </button>
              ))}
            </div>
            <Textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={2} maxLength={600} aria-label={t("tn.participate.comment")} placeholder={t("tn.participate.comment")} />
            <Button type="button" size="sm" className="self-start" disabled={!stance || busy} onClick={() => void send()}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {current.mine ? t("tn.participate.opinion_change") : t("tn.participate.opinion_send")}
            </Button>
            {current.mine ? <p className="text-[0.8125rem] text-muted-foreground" role="status">{t("tn.participate.opinion_mine", { stance: t(`tn.participate.stance.${current.mine.stance}` as MessageKey) })}</p> : null}
          </>
        )}
      </section>
    </article>
  );
}
