"use client";

import { Landmark, Loader2, Send, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useI18n } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, ApiRequestError } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { formatDateTime } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { OFFICIAL_DURATIONS, OFFICIAL_LINKS } from "@/modules/official-messages/official-messages.schema";
import type { OfficialMessageDto } from "@/modules/official-messages/official-messages.service";

import { FormField, SELECT_CLASS } from "./form-field";

/**
 * F73 — the High Council writes one short message: what residents must know,
 * what they must do, and how long it stays on every screen. The preview shows
 * the band exactly as residents get it.
 */
export function OfficialMessageComposer({ history }: { readonly history: readonly OfficialMessageDto[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [action, setAction] = useState("");
  const [linkHref, setLinkHref] = useState("");
  const [duration, setDuration] = useState("24");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [withdrawing, setWithdrawing] = useState<OfficialMessageDto | null>(null);

  const active = history.find((message) => message.state === "ACTIVE") ?? null;
  const ready = title.trim().length >= 5 && body.trim().length >= 10;

  const publish = async () => {
    setBusy(true);
    setFields({});
    try {
      await apiFetch("/api/official-messages", {
        method: "POST",
        body: {
          title: title.trim(),
          body: body.trim(),
          action: action.trim() || null,
          linkHref: linkHref || null,
          durationHours: duration === "none" ? null : Number(duration),
        },
      });
      toast.success(t("tn.official.published"));
      setTitle("");
      setBody("");
      setAction("");
      setLinkHref("");
      router.refresh();
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields) setFields(error.fields);
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const withdraw = async (message: OfficialMessageDto) => {
    try {
      await apiFetch(`/api/official-messages/${encodeURIComponent(message.id)}`, { method: "DELETE" });
      toast.success(t("tn.official.withdrawn"));
      router.refresh();
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setWithdrawing(null);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (ready) setConfirming(true);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-panel" noValidate>
        {active ? (
          <p role="note" className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-[0.8438rem]">
            {t("tn.official.replace_notice", { title: active.title })}
          </p>
        ) : null}
        <FormField id="official-title" label={t("tn.official.field.title")} {...(fields.title ? { error: fields.title } : {})}>
          <Input id="official-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={140} required placeholder={t("tn.official.field.title_hint")} />
        </FormField>
        <FormField id="official-body" label={t("tn.official.field.body")} {...(fields.body ? { error: fields.body } : {})}>
          <Textarea id="official-body" value={body} onChange={(event) => setBody(event.target.value)} maxLength={600} rows={3} required placeholder={t("tn.official.field.body_hint")} />
        </FormField>
        <FormField id="official-action" label={t("tn.official.field.action")} {...(fields.action ? { error: fields.action } : {})}>
          <Textarea id="official-action" value={action} onChange={(event) => setAction(event.target.value)} maxLength={300} rows={2} placeholder={t("tn.official.field.action_hint")} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="official-link" label={t("tn.official.field.link")}>
            <select id="official-link" value={linkHref} onChange={(event) => setLinkHref(event.target.value)} className={SELECT_CLASS}>
              <option value="">{t("tn.official.field.link_none")}</option>
              {OFFICIAL_LINKS.map((href) => (
                <option key={href} value={href}>
                  {t(`tn.official.link.${href.slice(1)}` as MessageKey)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="official-duration" label={t("tn.official.field.duration")}>
            <select id="official-duration" value={duration} onChange={(event) => setDuration(event.target.value)} className={SELECT_CLASS}>
              {OFFICIAL_DURATIONS.map((hours) => (
                <option key={hours} value={String(hours)}>
                  {t(`tn.official.duration.${hours}` as MessageKey)}
                </option>
              ))}
              <option value="none">{t("tn.official.duration.none")}</option>
            </select>
          </FormField>
        </div>
        <Button type="submit" disabled={!ready || busy} className="self-start">
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          {t("tn.official.publish")}
        </Button>
      </form>

      <div className="flex flex-col gap-5">
        <section aria-labelledby="official-preview" className="flex flex-col gap-2">
          <h2 id="official-preview" className="px-1 text-[0.8125rem] font-semibold text-muted-foreground">{t("tn.official.preview")}</h2>
          <div className="flex flex-col gap-2 rounded-b-[22px] rounded-t-md border border-border bg-card px-5 pb-4 pt-3 shadow-float">
            <p className="flex items-center gap-2 text-[0.75rem] font-semibold text-primary">
              <Landmark className="size-3.5" aria-hidden />
              {t("tn.official.label")}
            </p>
            <p className="text-[1.0625rem] font-semibold leading-snug">{title.trim() || t("tn.official.field.title_hint")}</p>
            <p className="text-[0.9062rem] leading-relaxed">{body.trim() || t("tn.official.field.body_hint")}</p>
            {action.trim() ? (
              <p className="rounded-xl bg-surface-muted px-3 py-2 text-[0.9062rem]">
                <span className="font-semibold">{t("tn.official.todo")} </span>
                {action.trim()}
              </p>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="official-history" className="flex flex-col gap-2">
          <h2 id="official-history" className="px-1 text-[0.8125rem] font-semibold text-muted-foreground">{t("tn.official.history")}</h2>
          {history.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{t("tn.official.history_empty")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {history.map((message) => (
                <li key={message.id} className="flex flex-col gap-1.5 rounded-2xl border border-border/70 bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={message.state === "ACTIVE" ? "success" : "neutral"}>{t(`tn.official.state.${message.state}` as MessageKey)}</Badge>
                    <span className="text-[0.75rem] text-muted-foreground">
                      {formatDateTime(message.publishedAt, locale)}
                      {message.author ? ` · ${message.author}` : ""}
                    </span>
                  </div>
                  <p className="font-semibold leading-snug">{message.title}</p>
                  <p className="line-clamp-2 text-[0.8438rem] text-muted-foreground">{message.body}</p>
                  {message.state === "ACTIVE" ? (
                    <Button type="button" size="sm" variant="secondary" className="self-start" onClick={() => setWithdrawing(message)}>
                      <Undo2 aria-hidden />
                      {t("tn.official.withdraw")}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("tn.official.confirm_title")}
        description={t("tn.official.confirm_body")}
        confirmLabel={t("tn.official.publish")}
        onConfirm={() => void publish()}
      />
      <ConfirmDialog
        open={withdrawing !== null}
        onOpenChange={(open) => !open && setWithdrawing(null)}
        title={t("tn.official.withdraw_title")}
        description={t("tn.official.withdraw_body")}
        confirmLabel={t("tn.official.withdraw")}
        onConfirm={() => withdrawing && void withdraw(withdrawing)}
      />
    </div>
  );
}
