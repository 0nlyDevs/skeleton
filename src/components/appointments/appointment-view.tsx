"use client";

import { BellRing, CalendarPlus, CheckCircle2, ListChecks, Loader2, MapPin, MessageCircle, Phone, Sparkles, UserRound, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useI18n, useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Link from "@/components/ui/link";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import type { AppointmentDto } from "@/modules/appointments/appointments.dto";
import { formatSlot } from "@/modules/appointments/appointments.time";

const STATUS_TONE = {
  BOOKED: "border-success/40 bg-success/10 text-success",
  CANCELLED: "border-error/40 bg-error/10 text-error",
  DONE: "border-border bg-surface-muted text-foreground",
  MISSED: "border-warning/40 bg-warning/10 text-warning",
} as const;

/**
 * F39/F40 — one appointment, for the resident or the agent: the slot spelled
 * out in full, what to prepare, the reminders, the conversation between the
 * two, and what each side may do (cancel, add to a calendar, close it).
 */
export function AppointmentView({
  appointment,
  preparation,
  viewer,
  justBooked = false,
}: {
  readonly appointment: AppointmentDto;
  readonly preparation: readonly string[];
  readonly viewer: "citizen" | "agent";
  readonly justBooked?: boolean;
}) {
  const t = useTranslation();
  const { locale } = useI18n();
  const lang = locale === "en" ? "en" : "fr";
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [advice, setAdvice] = useState<{ steps: readonly string[]; source: "ai" | "general" } | null>(null);
  const [reminders, setReminders] = useState({ remindDayBefore: appointment.remindDayBefore, remindHourBefore: appointment.remindHourBefore });
  const base = `/api/appointments/${appointment.reference}`;

  const run = async (key: string, task: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await task();
      toast.success(success);
      router.refresh();
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(null);
    }
  };

  const saveReminders = (next: typeof reminders) => {
    setReminders(next);
    void run("reminders", () => apiFetch(`${base}/reminders`, { method: "PUT", body: JSON.stringify(next) }), t("tn.appointments.reminders_saved"));
  };

  const askAdvice = async () => {
    setBusy("advice");
    try {
      const response = await apiFetch<{ data: { steps: string[]; source: "ai" | "general" } }>(`${base}/preparation`, { method: "POST" });
      setAdvice(response.data);
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {justBooked ? (
        <p role="status" className="flex items-center gap-2 rounded-2xl border border-success/40 bg-success/10 p-4 font-medium">
          <CheckCircle2 className="size-5 text-success" aria-hidden />
          {t("tn.appointments.booked_banner")}
        </p>
      ) : null}

      <section className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-5 shadow-panel">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-muted-foreground">{appointment.reference}</span>
          <span className={cn("rounded-full border px-2 py-0.5 text-[0.75rem] font-semibold", STATUS_TONE[appointment.status])}>{t(`tn.appointments.status.${appointment.status}`)}</span>
        </div>
        <h1 className="text-xl font-semibold leading-snug first-letter:uppercase sm:text-2xl">{formatSlot(appointment.startsAt, appointment.endsAt, lang)}</h1>
        <ul className="flex flex-col gap-1.5 text-[0.9375rem]">
          <li className="flex items-center gap-2">
            {appointment.mode === "PHONE" ? <Phone className="size-4 text-primary" aria-hidden /> : <MapPin className="size-4 text-primary" aria-hidden />}
            {appointment.mode === "PHONE" ? t("tn.appointments.by_phone_long") : appointment.location}
            <span className="text-muted-foreground">· {t("tn.appointments.minutes", { count: appointment.durationMinutes })}</span>
          </li>
          <li className="flex items-center gap-2">
            <UserRound className="size-4 text-primary" aria-hidden />
            {viewer === "citizen" ? t("tn.appointments.with", { name: appointment.agent.name }) : t("tn.appointments.with_citizen", { name: appointment.citizen.name })}
            {appointment.service ? (
              <>
                {" · "}
                <Link href={`/services/${appointment.service.slug}`} className="text-primary underline underline-offset-2">
                  {appointment.service.name}
                </Link>
              </>
            ) : null}
          </li>
        </ul>
        <div className="rounded-xl bg-surface-muted p-3 text-[0.9062rem]">
          <p className="text-[0.75rem] font-semibold uppercase tracking-wide text-muted-foreground">{t("tn.appointments.reason")}</p>
          <p className="whitespace-pre-line">{appointment.reason}</p>
        </div>
        {appointment.status === "CANCELLED" && appointment.cancelReason ? (
          <p className="text-sm text-muted-foreground">{t("tn.appointments.cancel_reason_shown", { reason: appointment.cancelReason })}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {appointment.roomId ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/messages?room=${encodeURIComponent(appointment.roomId)}`}>
                <MessageCircle aria-hidden />
                {t(viewer === "citizen" ? "tn.appointments.message_agent" : "tn.appointments.message_citizen")}
              </Link>
            </Button>
          ) : null}
          {appointment.upcoming ? (
            <Button asChild variant="secondary" size="sm">
              <a href={`${base}/ics`} download={`${appointment.reference}.ics`}>
                <CalendarPlus aria-hidden />
                {t("tn.appointments.add_calendar")}
              </a>
            </Button>
          ) : null}
          {appointment.upcoming ? (
            <Button variant="secondary" size="sm" onClick={() => setCancelOpen(true)}>
              <XCircle aria-hidden />
              {t("tn.appointments.cancel")}
            </Button>
          ) : null}
          {viewer === "agent" && appointment.status === "BOOKED" && appointment.started ? (
            <>
              <Button size="sm" onClick={() => void run("done", () => apiFetch(`${base}/outcome`, { method: "POST", body: JSON.stringify({ status: "DONE" }) }), t("tn.appointments.outcome_saved"))} disabled={busy !== null}>
                {t("tn.appointments.mark_done")}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void run("missed", () => apiFetch(`${base}/outcome`, { method: "POST", body: JSON.stringify({ status: "MISSED" }) }), t("tn.appointments.outcome_saved"))} disabled={busy !== null}>
                {t("tn.appointments.mark_missed")}
              </Button>
            </>
          ) : null}
        </div>
      </section>

      {viewer === "citizen" && appointment.status === "BOOKED" ? (
        <section aria-labelledby="appointment-prepare" className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-5 shadow-panel">
          <h2 id="appointment-prepare" className="flex items-center gap-2 font-semibold">
            <ListChecks className="size-5 text-primary" aria-hidden />
            {t("tn.appointments.prepare")}
          </h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[0.9375rem]">
            {preparation.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
          {advice ? (
            <div className="flex flex-col gap-1.5 rounded-xl border border-primary/30 bg-accent/40 p-3">
              <p className="text-[0.75rem] font-semibold uppercase tracking-wide text-muted-foreground">
                {t(advice.source === "ai" ? "tn.appointments.advice_ai" : "tn.appointments.advice_general")}
              </p>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-[0.9375rem]">
                {advice.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </div>
          ) : (
            <Button variant="secondary" size="sm" className="w-fit" onClick={() => void askAdvice()} disabled={busy === "advice"}>
              {busy === "advice" ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
              {t("tn.appointments.ask_advice")}
            </Button>
          )}
        </section>
      ) : null}

      {viewer === "citizen" && appointment.upcoming ? (
        <section aria-labelledby="appointment-reminders" className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-card p-5 shadow-panel">
          <h2 id="appointment-reminders" className="flex items-center gap-2 font-semibold">
            <BellRing className="size-5 text-primary" aria-hidden />
            {t("tn.appointments.reminders")}
          </h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={reminders.remindDayBefore} disabled={busy === "reminders"} onChange={(event) => saveReminders({ ...reminders, remindDayBefore: event.target.checked })} />
            {t("tn.appointments.remind_day")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={reminders.remindHourBefore} disabled={busy === "reminders"} onChange={(event) => saveReminders({ ...reminders, remindHourBefore: event.target.checked })} />
            {t("tn.appointments.remind_hour")}
          </label>
          <p className="text-[0.8125rem] text-muted-foreground">{t("tn.appointments.reminders_hint")}</p>
        </section>
      ) : null}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("tn.appointments.cancel_title")}</DialogTitle>
            <DialogDescription>{t(viewer === "citizen" ? "tn.appointments.cancel_body" : "tn.appointments.cancel_body_agent")}</DialogDescription>
          </DialogHeader>
          <Textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} maxLength={300} rows={2} placeholder={t("tn.appointments.cancel_reason")} />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              {t("tn.appointments.keep")}
            </Button>
            <Button
              variant="destructive"
              disabled={busy === "cancel"}
              onClick={() =>
                void run("cancel", () => apiFetch(`${base}/cancel`, { method: "POST", body: JSON.stringify({ reason: cancelReason }) }), t("tn.appointments.cancelled")).then(() => setCancelOpen(false))
              }
            >
              {busy === "cancel" ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {t("tn.appointments.cancel_confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
