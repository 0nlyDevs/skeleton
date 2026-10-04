"use client";

import { Check, Loader2, Send } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/feedback/empty-state";
import { useI18n } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, ApiRequestError } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { CITY_ZONE_IDS, cityZoneLabelKey, type CityZoneId } from "@/modules/alerts/city-zones";
import { IDEA_STATUSES } from "@/modules/participation/participation.schema";
import type { IdeaDto } from "@/modules/participation/participation.service";

import { SELECT_CLASS } from "@/components/agent/form-field";

const FILL: Record<IdeaDto["status"], "ring" | "half" | "full" | "closed"> = { RECEIVED: "ring", STUDYING: "half", KEPT: "full", DECLINED: "closed", DONE: "full" };

/**
 * F68 — residents propose ideas, support the ones they like (once each) and
 * read the city's answer. Agents answer from the same list.
 */
export function IdeaBoard({ initial, signedIn, staff }: { readonly initial: readonly IdeaDto[]; readonly signedIn: boolean; readonly staff: boolean }) {
  const { t } = useI18n();
  const [ideas, setIdeas] = useState<readonly IdeaDto[]>(initial);
  const [sort, setSort] = useState<"supported" | "recent">("supported");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [zone, setZone] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [answering, setAnswering] = useState<string | null>(null);
  const [status, setStatus] = useState<IdeaDto["status"]>("STUDYING");
  const [answer, setAnswer] = useState("");

  const replace = useCallback((next: IdeaDto) => setIdeas((current) => current.map((idea) => (idea.reference === next.reference ? next : idea))), []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFields({});
    try {
      const { data } = await apiFetch<{ data: IdeaDto }>("/api/ideas", { method: "POST", body: { title: title.trim(), body: body.trim(), zone: zone || null } });
      setIdeas((current) => [data, ...current]);
      setTitle("");
      setBody("");
      toast.success(t("tn.participate.idea_sent", { reference: data.reference }));
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields) setFields(error.fields);
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (idea: IdeaDto) => {
    try {
      const { data } = await apiFetch<{ data: IdeaDto }>(`/api/ideas/${idea.reference}/support`, { method: idea.supportedByMe ? "DELETE" : "POST" });
      replace(data);
    } catch (error) {
      toast.error(describeApiError(error, t));
    }
  };

  const reply = async (idea: IdeaDto) => {
    try {
      const { data } = await apiFetch<{ data: IdeaDto }>(`/api/ideas/${idea.reference}`, { method: "PATCH", body: { status, answer: answer.trim() || null } });
      replace(data);
      setAnswering(null);
      setAnswer("");
      toast.success(t("tn.participate.idea_answered"));
    } catch (error) {
      toast.error(describeApiError(error, t));
    }
  };

  const shown = [...ideas].sort((a, b) => (sort === "supported" ? b.supports - a.supports || b.createdAt.localeCompare(a.createdAt) : b.createdAt.localeCompare(a.createdAt)));

  return (
    <div className="flex flex-col gap-5">
      {signedIn ? (
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-panel" noValidate>
          <h3 className="text-lg font-semibold">{t("tn.participate.idea_form")}</h3>
          <div className="flex flex-col">
            <Label htmlFor="idea-title">{t("tn.participate.idea_title")}</Label>
            <Input id="idea-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={140} required aria-invalid={Boolean(fields.title)} />
            {fields.title ? <p role="alert" className="mt-1 text-[0.8125rem] text-error">{fields.title}</p> : null}
          </div>
          <div className="flex flex-col">
            <Label htmlFor="idea-body">{t("tn.participate.idea_body")}</Label>
            <Textarea id="idea-body" value={body} onChange={(event) => setBody(event.target.value)} rows={3} maxLength={1500} required aria-invalid={Boolean(fields.body)} />
            {fields.body ? <p role="alert" className="mt-1 text-[0.8125rem] text-error">{fields.body}</p> : null}
          </div>
          <div className="flex flex-col">
            <Label htmlFor="idea-zone">{t("tn.participate.idea_zone")}</Label>
            <select id="idea-zone" value={zone} onChange={(event) => setZone(event.target.value)} className={SELECT_CLASS}>
              <option value="">{t("tn.participate.idea_zone_all")}</option>
              {CITY_ZONE_IDS.map((id) => (
                <option key={id} value={id}>{t(cityZoneLabelKey(id))}</option>
              ))}
            </select>
          </div>
          <Button type="submit" className="self-start" disabled={busy || title.trim().length < 5 || body.trim().length < 15}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
            {t("tn.participate.idea_send")}
          </Button>
        </form>
      ) : (
        <p className="rounded-2xl bg-card p-5 text-sm shadow-panel">
          {t("tn.participate.sign_in")} <Link href="/login?next=/participate%3Ftab%3Dideas" className="font-medium text-primary">{t("nav.sign_in")}</Link>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("tn.participate.idea_sort")}>
        {(["supported", "recent"] as const).map((value) => (
          <button key={value} type="button" aria-pressed={sort === value} onClick={() => setSort(value)} className={cn("rounded-full px-4 py-2 text-sm font-medium", sort === value ? "bg-foreground text-background" : "bg-card hover:bg-accent")}>
            {t(`tn.participate.idea_sort.${value}` as MessageKey)}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState title={t("tn.participate.idea_empty_title")} description={t("tn.participate.idea_empty_body")} />
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((idea) => (
            <li key={idea.reference} id={idea.reference} className="flex scroll-mt-24 flex-col gap-3 rounded-2xl bg-card p-5 shadow-panel target:ring-2 target:ring-foreground/50">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={idea.status === "KEPT" || idea.status === "DONE" ? "success" : "neutral"}>
                  <span className="state-bubble" data-fill={FILL[idea.status]} aria-hidden />
                  {t(`tn.participate.idea_status.${idea.status}` as MessageKey)}
                </Badge>
                {idea.zone ? <Badge variant="outline">{t(cityZoneLabelKey(idea.zone as CityZoneId))}</Badge> : null}
                <span className="ml-auto font-mono text-[0.75rem] text-muted-foreground">{idea.reference}</span>
              </div>
              <h4 className="text-lg font-semibold leading-snug">{idea.title}</h4>
              <p className="prose-body text-[0.9375rem]">{idea.body}</p>
              {idea.answer ? (
                <div className="rounded-xl bg-surface-muted px-3 py-2.5">
                  <p className="mb-1 text-[0.75rem] font-semibold text-muted-foreground">{t("tn.participate.idea_city_answer")}</p>
                  <p className="text-[0.9062rem]">{idea.answer}</p>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                {signedIn && !idea.mine ? (
                  <Button type="button" size="sm" variant={idea.supportedByMe ? "secondary" : "primary"} aria-pressed={idea.supportedByMe} onClick={() => void toggle(idea)}>
                    {idea.supportedByMe ? <Check aria-hidden /> : null}
                    {idea.supportedByMe ? t("tn.participate.idea_supported") : t("tn.participate.idea_support")}
                  </Button>
                ) : null}
                <span className="text-sm text-muted-foreground tabular-nums">{t("tn.participate.idea_supports", { count: idea.supports })}</span>
                {idea.mine ? <Badge variant="outline">{t("tn.participate.idea_mine")}</Badge> : null}
                {staff ? (
                  <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={() => { setAnswering(idea.reference); setStatus(idea.status === "RECEIVED" ? "STUDYING" : idea.status); setAnswer(idea.answer ?? ""); }}>
                    {t("tn.participate.idea_answer")}
                  </Button>
                ) : null}
              </div>
              {staff && answering === idea.reference ? (
                <div className="flex flex-col gap-2 rounded-xl border border-border/70 p-3">
                  <Label htmlFor={`status-${idea.reference}`}>{t("tn.participate.idea_state")}</Label>
                  <select id={`status-${idea.reference}`} value={status} onChange={(event) => setStatus(event.target.value as IdeaDto["status"])} className={SELECT_CLASS}>
                    {IDEA_STATUSES.map((value) => (
                      <option key={value} value={value}>{t(`tn.participate.idea_status.${value}` as MessageKey)}</option>
                    ))}
                  </select>
                  <Textarea value={answer} onChange={(event) => setAnswer(event.target.value)} rows={2} maxLength={1000} aria-label={t("tn.participate.idea_city_answer")} />
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={() => void reply(idea)}>{t("tn.participate.idea_answer_send")}</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setAnswering(null)}>{t("common.cancel")}</Button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
