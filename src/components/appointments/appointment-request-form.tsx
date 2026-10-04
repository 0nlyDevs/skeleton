"use client";

import { CalendarClock, CheckCircle2, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { SELECT_CLASS } from "@/components/agent/form-field";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "@/components/ui/link";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, ApiRequestError } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { toast } from "sonner";
import { SLOT_DURATIONS } from "@/modules/appointments/appointments.time";
import type { AppointmentRequestDto } from "@/modules/appointments/appointment-requests.service";

/**
 * No slot at the right time? Ask for the one you need: a day, a time, how
 * long, and what it is about. Agents are told at once and answer here.
 */
export function AppointmentRequestForm({ services, initialService }: { readonly services: readonly { slug: string; name: string }[]; readonly initialService: string }) {
  const t = useTranslation();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState("30");
  const [mode, setMode] = useState<"IN_PERSON" | "PHONE">("IN_PERSON");
  const [service, setService] = useState(initialService);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [sent, setSent] = useState<AppointmentRequestDto | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFields({});
    try {
      // The city keeps one civil time (UTC): the day and time typed are read in it.
      const { data } = await apiFetch<{ data: AppointmentRequestDto }>("/api/appointment-requests", {
        method: "POST",
        body: { startsAt: `${date}T${time}:00Z`, duration: Number(duration), mode, serviceSlug: service || null, reason: reason.trim() },
      });
      setSent(data);
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields) setFields(error.fields);
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-2xl bg-success/10 p-5">
        <p className="flex items-center gap-2 font-semibold text-success">
          <CheckCircle2 className="size-5" aria-hidden />
          {t("tn.appointments.request.sent_title", { reference: sent.reference })}
        </p>
        <p className="text-sm">{t("tn.appointments.request.sent_body")}</p>
        <Link href="/appointments#requests" className="w-fit text-sm font-medium text-primary">{t("tn.appointments.request.follow")}</Link>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-panel" noValidate>
      <div className="flex flex-col gap-0.5">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CalendarClock className="size-[1.125rem]" aria-hidden />
          {t("tn.appointments.request.title")}
        </h2>
        <p className="text-[0.8438rem] text-muted-foreground">{t("tn.appointments.request.hint")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col">
          <Label htmlFor="req-date">{t("tn.appointments.request.date")}</Label>
          <Input id="req-date" type="date" min={today} value={date} onChange={(event) => setDate(event.target.value)} required aria-invalid={Boolean(fields.startsAt)} />
          {fields.startsAt ? <p role="alert" className="mt-1 text-[0.8125rem] text-error">{fields.startsAt}</p> : null}
        </div>
        <div className="flex flex-col">
          <Label htmlFor="req-time">{t("tn.appointments.request.time")}</Label>
          <Input id="req-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} required />
        </div>
        <div className="flex flex-col">
          <Label htmlFor="req-duration">{t("tn.appointments.request.duration")}</Label>
          <select id="req-duration" value={duration} onChange={(event) => setDuration(event.target.value)} className={SELECT_CLASS}>
            {SLOT_DURATIONS.map((value) => (
              <option key={value} value={value}>{t("tn.appointments.request.minutes", { count: value })}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <Label htmlFor="req-mode">{t("tn.appointments.request.mode")}</Label>
          <select id="req-mode" value={mode} onChange={(event) => setMode(event.target.value as "IN_PERSON" | "PHONE")} className={SELECT_CLASS}>
            <option value="IN_PERSON">{t("tn.appointments.request.in_person")}</option>
            <option value="PHONE">{t("tn.appointments.request.phone")}</option>
          </select>
        </div>
      </div>
      <div className="flex flex-col">
        <Label htmlFor="req-service">{t("tn.appointments.request.service")}</Label>
        <select id="req-service" value={service} onChange={(event) => setService(event.target.value)} className={SELECT_CLASS}>
          <option value="">{t("tn.no_service")}</option>
          {services.map((item) => (
            <option key={item.slug} value={item.slug}>{item.name}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col">
        <Label htmlFor="req-reason">{t("tn.appointments.request.reason")}</Label>
        <Textarea id="req-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={1000} required aria-invalid={Boolean(fields.reason)} />
        {fields.reason ? <p role="alert" className="mt-1 text-[0.8125rem] text-error">{fields.reason}</p> : null}
      </div>
      <p className="text-[0.75rem] text-muted-foreground">{t("tn.appointments.request.zone")}</p>
      <Button type="submit" className="self-start" disabled={busy || !date || reason.trim().length < 10}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {t("tn.appointments.request.send")}
      </Button>
    </form>
  );
}
