"use client";

import { Bot, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { WebcupRequestDto } from "@/modules/webcup/webcup.service";

const TRIAGES = ["TODO", "IN_PROGRESS", "DONE", "SKIPPED"] as const;
const TRIAGE_VARIANT: Readonly<Record<string, BadgeProps["variant"]>> = {
  TODO: "neutral",
  IN_PROGRESS: "warning",
  DONE: "success",
  SKIPPED: "outline",
};
const DIFFICULTY_VARIANT: Readonly<Record<number, BadgeProps["variant"]>> = { 1: "success", 2: "warning", 3: "error" };

/** One request from the Nova Terra API, with the team's tracking of it. */
export function WebcupRequestCard({
  request,
  onChanged,
}: {
  readonly request: WebcupRequestDto;
  readonly onChanged: (request: WebcupRequestDto) => void;
}) {
  const t = useTranslation();
  const [note, setNote] = useState(request.note ?? "");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async (patch: { triage?: string; note?: string | null }) => {
    setBusy(true);
    try {
      await apiFetch(`/api/webcup/requests/${encodeURIComponent(request.code)}`, { method: "PATCH", body: patch });
      onChanged({ ...request, ...patch, note: patch.note !== undefined ? patch.note : request.note } as WebcupRequestDto);
      setEditing(false);
      toast.success(t("tn.agent.feed.saved"));
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-panel",
        request.triage === "DONE" ? "border-success/40" : "border-border/70",
        !request.visible && "opacity-60",
      )}
      aria-labelledby={`webcup-${request.code}`}
    >
      <header className="flex flex-wrap items-center gap-1.5">
        <span id={`webcup-${request.code}`} className="rounded-md bg-primary px-2 py-0.5 font-mono text-[13px] font-semibold text-primary-foreground">
          {request.code}
        </span>
        <Badge variant="primary">{request.xpAvailable} XP</Badge>
        {request.difficulty ? (
          <Badge variant={DIFFICULTY_VARIANT[request.difficultyLevel ?? 0] ?? "neutral"}>
            {t("tn.agent.feed.difficulty")} : {request.difficulty}
          </Badge>
        ) : null}
        <Badge variant="outline">{request.isInitial ? t("tn.agent.feed.initial") : t("tn.agent.feed.wave_n", { wave: request.wave ?? "?" })}</Badge>
        {request.isAiRelated ? (
          <Badge variant="outline">
            <Bot className="size-3" aria-hidden />
            {t("tn.agent.feed.ai")}
          </Badge>
        ) : null}
        {!request.visible ? <Badge variant="warning">{t("tn.agent.feed.hidden")}</Badge> : null}
        <Badge variant={TRIAGE_VARIANT[request.triage] ?? "neutral"} className="ml-auto">
          {t(`tn.triage.${request.triage}` as MessageKey)}
        </Badge>
      </header>

      {request.requesterName || request.requesterType ? (
        <p className="text-[12.5px] text-muted-foreground">
          {t("tn.agent.feed.from", { name: request.requesterName ?? "—", type: request.requesterType ?? "—" })}
        </p>
      ) : null}
      <p className="whitespace-pre-line text-[14.5px] leading-relaxed">{request.message}</p>

      {editing ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={`note-${request.code}`} className="text-[13px] font-medium">{t("tn.agent.feed.note")}</label>
          <Textarea id={`note-${request.code}`} value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("tn.agent.feed.note_placeholder")} rows={3} maxLength={2000} />
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>{t("common.cancel")}</Button>
            <Button size="sm" disabled={busy} onClick={() => void save({ note: note.trim() || null })}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {t("common.save")}
            </Button>
          </div>
        </div>
      ) : request.note ? (
        <button type="button" onClick={() => setEditing(true)} className="rounded-xl bg-surface-muted px-3 py-2 text-left text-[13px]">
          <span className="font-medium">{t("tn.agent.feed.note")} : </span>
          {request.note}
        </button>
      ) : null}

      <footer className="flex flex-wrap items-center gap-2">
        <label htmlFor={`triage-${request.code}`} className="text-[13px] text-muted-foreground">{t("tn.agent.feed.triage")}</label>
        <select
          id={`triage-${request.code}`}
          value={request.triage}
          disabled={busy}
          onChange={(event) => void save({ triage: event.target.value })}
          className="h-8 rounded-[var(--radius-control)] border border-input bg-surface px-2 text-[13px]"
        >
          {TRIAGES.map((triage) => (
            <option key={triage} value={triage}>{t(`tn.triage.${triage}` as MessageKey)}</option>
          ))}
        </select>
        {!editing ? (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            {t("tn.agent.feed.note")}
          </Button>
        ) : null}
      </footer>
    </article>
  );
}
