"use client";

import { CheckCircle2, Loader2, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import Link from "@/components/ui/link";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, ApiRequestError } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { formatDateTime } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ServiceFeedbackDto } from "@/modules/service-feedback/service-feedback.service";

import { FeedbackTrail } from "./feedback-trail";

const RATINGS = [1, 2, 3, 4, 5] as const;

/**
 * F76 — "how did it go?": five bubbles and a few words. Once sent, the form
 * becomes the proof: a reference, the three steps the comment will go
 * through, and where to follow it.
 */
export function FeedbackForm({
  serviceSlug,
  serviceName,
  requestReference,
  idPrefix = "feedback",
}: {
  readonly serviceSlug: string;
  readonly serviceName: string;
  /** The resident's request this comment follows, when there is one. */
  readonly requestReference?: string;
  readonly idPrefix?: string;
}) {
  const { t, locale } = useI18n();
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [sent, setSent] = useState<ServiceFeedbackDto | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (rating === null) {
      setFields({ rating: t("tn.feedback.rating_required") });
      document.getElementById(`${idPrefix}-rating-1`)?.focus();
      return;
    }
    setBusy(true);
    setFields({});
    try {
      const { data } = await apiFetch<{ data: ServiceFeedbackDto }>("/api/service-feedback", {
        method: "POST",
        body: { serviceSlug, rating, comment: comment.trim(), ...(requestReference ? { requestReference } : {}) },
      });
      setSent(data);
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields) {
        setFields(error.fields);
        if (error.fields.comment) requestAnimationFrame(() => document.getElementById(`${idPrefix}-comment`)?.focus());
      }
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div role="status" className="flex flex-col gap-3 rounded-2xl border border-success/40 bg-success/10 p-4">
        <p className="flex items-center gap-2 font-semibold">
          <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />
          {t("tn.feedback.sent_title", { reference: sent.reference })}
        </p>
        <p className="text-sm">{t("tn.feedback.sent_body", { service: serviceName })}</p>
        <FeedbackTrail status={sent.status} dates={{ received: formatDateTime(sent.createdAt, locale), read: null, answered: null }} t={t} />
        <Link href={`/space/feedback#${sent.reference}`} className="w-fit text-sm font-medium text-primary hover:underline">
          {t("tn.feedback.follow")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4" noValidate>
      <fieldset className="flex flex-col gap-2" aria-describedby={fields.rating ? `${idPrefix}-rating-error` : undefined}>
        <legend className="mb-2 text-sm font-medium">
          {t("tn.feedback.rating_label")}
          <span className="text-error" aria-hidden> *</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {RATINGS.map((value) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border px-3 py-2 text-[0.75rem] transition-colors focus-within:ring-2 focus-within:ring-ring/50",
                rating === value ? "border-primary bg-accent font-medium" : "border-input hover:bg-surface-muted",
              )}
            >
              <input
                id={`${idPrefix}-rating-${value}`}
                type="radio"
                name={`${idPrefix}-rating`}
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
                className="sr-only"
              />
              {/* The level is a bubble filling up: one fifth per step. */}
              <span aria-hidden className="relative size-7 overflow-hidden rounded-full border-[1.5px] border-foreground/70">
                <span className="absolute inset-x-0 bottom-0 bg-foreground/70" style={{ height: `${value * 20}%` }} />
              </span>
              {t(`tn.feedback.rating.${value}` as MessageKey)}
            </label>
          ))}
        </div>
        {fields.rating ? <p id={`${idPrefix}-rating-error`} role="alert" className="text-[0.8125rem] text-error">{fields.rating}</p> : null}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-comment`}>
          {t("tn.feedback.comment_label")}
          <span className="text-error" aria-hidden> *</span>
        </Label>
        <Textarea
          id={`${idPrefix}-comment`}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={3}
          maxLength={1500}
          required
          placeholder={t("tn.feedback.comment_hint")}
          aria-invalid={fields.comment ? true : undefined}
          aria-describedby={fields.comment ? `${idPrefix}-comment-error` : `${idPrefix}-privacy`}
        />
        {fields.comment ? <p id={`${idPrefix}-comment-error`} role="alert" className="text-[0.8125rem] text-error">{fields.comment}</p> : null}
        <p id={`${idPrefix}-privacy`} className="text-[0.75rem] text-muted-foreground">{t("tn.feedback.privacy")}</p>
      </div>

      <Button type="submit" disabled={busy} className="self-start">
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
        {t("tn.feedback.send")}
      </Button>
    </form>
  );
}
