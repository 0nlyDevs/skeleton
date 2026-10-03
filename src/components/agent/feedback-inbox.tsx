"use client";

import { Check, Loader2, MessageSquareHeart, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { FeedbackTrail } from "@/components/city/feedback-trail";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, toQueryString } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { formatDateTime } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { FEEDBACK_STATUSES } from "@/modules/service-feedback/service-feedback.schema";
import type { ServiceFeedbackDto, ServiceFeedbackPage } from "@/modules/service-feedback/service-feedback.service";

import { SELECT_CLASS } from "./form-field";

type Status = (typeof FEEDBACK_STATUSES)[number];

/**
 * F76 — residents' comments, as agents read them: the unread ones first, one
 * tap to confirm a comment was read (the resident is told), one field to
 * answer.
 */
export function FeedbackInbox({ services }: { readonly services: readonly { slug: string; name: string }[] }) {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<Status | "ALL">("RECEIVED");
  const [service, setService] = useState("");
  const [page, setPage] = useState<ServiceFeedbackPage | null>(null);
  const [failed, setFailed] = useState(false);
  const [replying, setReplying] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setPage(await apiFetch<ServiceFeedbackPage>(`/api/service-feedback${toQueryString({ scope: "all", status: status === "ALL" ? undefined : status, service: service || undefined, limit: 50 })}`));
    } catch {
      setFailed(true);
    }
  }, [status, service]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = async (item: ServiceFeedbackDto, body: { read: true } | { reply: string }) => {
    setBusy(item.reference);
    try {
      await apiFetch(`/api/service-feedback/${item.reference}`, { method: "PATCH", body });
      toast.success(t("reply" in body ? "tn.feedback.agent.replied" : "tn.feedback.agent.marked_read"));
      setReplying(null);
      setReply("");
      await load();
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(null);
    }
  };

  const tabs: readonly (Status | "ALL")[] = ["RECEIVED", "READ", "ANSWERED", "ALL"];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t("tn.feedback.agent.filter")} className="flex flex-wrap gap-1.5">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={status === tab}
              onClick={() => setStatus(tab)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[0.8125rem] font-medium",
                status === tab ? "bg-foreground text-background" : "border border-border bg-surface hover:bg-surface-muted",
              )}
            >
              {t(`tn.feedback.agent.tab.${tab}` as MessageKey)}
              {tab !== "ALL" && page?.counts?.[tab] ? <span className="ml-1.5 tabular-nums opacity-75">{page.counts[tab]}</span> : null}
            </button>
          ))}
        </div>
        <select value={service} onChange={(event) => setService(event.target.value)} aria-label={t("tn.feedback.agent.service")} className={cn(SELECT_CLASS, "ml-auto h-9 w-auto max-w-full")}>
          <option value="">{t("tn.feedback.agent.all_services")}</option>
          {services.map((item) => (
            <option key={item.slug} value={item.slug}>{item.name}</option>
          ))}
        </select>
      </div>

      {failed ? (
        <ErrorState onRetry={() => void load()} />
      ) : page === null ? (
        <div className="flex flex-col gap-3" aria-busy>
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      ) : page.data.length === 0 ? (
        <EmptyState icon={MessageSquareHeart} title={t("tn.feedback.agent.empty_title")} description={t("tn.feedback.agent.empty_body")} />
      ) : (
        <ul className="flex flex-col gap-3">
          {page.data.map((item) => (
            <li key={item.reference} id={item.reference} className="flex scroll-mt-24 flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-panel target:border-primary/50">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">
                  {item.service.name}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {t(`tn.feedback.rating.${item.rating}` as MessageKey)} · {t("tn.feedback.rating_out_of", { rating: item.rating })}
                  </span>
                </p>
                <p className="font-mono text-[0.8125rem] text-muted-foreground">{item.reference}</p>
              </div>
              <p className="text-[0.8125rem] text-muted-foreground">
                {item.author?.name ?? "—"}
                {item.request ? (
                  <>
                    {" · "}
                    <Link href={`/agent/requests/${item.request.reference}`} className="text-primary hover:underline">
                      {t("tn.feedback.about_request", { reference: item.request.reference })}
                    </Link>
                  </>
                ) : null}
              </p>
              <p className="prose-body text-[0.9375rem]">{item.comment}</p>
              <FeedbackTrail
                status={item.status}
                dates={{
                  received: formatDateTime(item.createdAt, locale),
                  read: item.readAt ? formatDateTime(item.readAt, locale) : null,
                  answered: item.repliedAt ? formatDateTime(item.repliedAt, locale) : null,
                }}
                t={t}
              />
              {item.reply ? (
                <div className="rounded-xl bg-surface-muted px-3 py-2.5">
                  <p className="mb-1 text-[0.75rem] font-semibold text-muted-foreground">{t("tn.feedback.agent.your_reply")}</p>
                  <p className="prose-body text-[0.9062rem]">{item.reply}</p>
                </div>
              ) : replying === item.reference ? (
                <form
                  className="flex flex-col gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (reply.trim().length >= 5) void update(item, { reply: reply.trim() });
                  }}
                >
                  <Textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={3} maxLength={1500} aria-label={t("tn.feedback.agent.reply_label")} placeholder={t("tn.feedback.agent.reply_hint")} autoFocus />
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" size="sm" disabled={busy === item.reference || reply.trim().length < 5}>
                      {busy === item.reference ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
                      {t("tn.feedback.agent.send_reply")}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setReplying(null)}>
                      {t("common.cancel")}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {item.status === "RECEIVED" ? (
                    <Button type="button" size="sm" variant="secondary" disabled={busy === item.reference} onClick={() => void update(item, { read: true })}>
                      {busy === item.reference ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
                      {t("tn.feedback.agent.mark_read")}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setReply("");
                      setReplying(item.reference);
                    }}
                  >
                    {t("tn.feedback.agent.reply")}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
