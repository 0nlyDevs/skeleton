"use client";

import { CalendarCheck2, Loader2, MapPin, Phone, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useI18n, useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, ApiRequestError } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import type { AppointmentDto, FreeSlotDto } from "@/modules/appointments/appointments.dto";
import { CITY_TIME_ZONE, cityDay, formatSlot } from "@/modules/appointments/appointments.time";

const FIELD = "h-10 w-full rounded-[var(--radius-control)] border border-input bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

/**
 * F39 — book an appointment in three steps that leave no doubt about the
 * slot: pick a day, pick a time (each with its length, place and agent), then
 * read the full summary — day, date, times and time zone — before confirming.
 */
export function AppointmentBooking({
  services,
  initialService,
}: {
  readonly services: readonly { slug: string; name: string }[];
  readonly initialService: string;
}) {
  const t = useTranslation();
  const { locale } = useI18n();
  const lang = locale === "en" ? "en" : "fr";
  const router = useRouter();
  const [service, setService] = useState(initialService);
  const [slots, setSlots] = useState<readonly FreeSlotDto[] | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [remindDay, setRemindDay] = useState(true);
  const [remindHour, setRemindHour] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reasonError, setReasonError] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ data: FreeSlotDto[] }>(`/api/appointments/slots${service ? `?service=${encodeURIComponent(service)}` : ""}`)
      .then((response) => {
        if (cancelled) return;
        setSlots(response.data);
        setDay((current) => (current && response.data.some((slot) => cityDay(slot.startsAt) === current) ? current : (response.data[0] ? cityDay(response.data[0].startsAt) : null)));
        setSlotId((current) => (current && response.data.some((slot) => slot.id === current) ? current : null));
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSlots([]);
          toast.error(describeApiError(error, t));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [service, reload, t]);

  const days = useMemo(() => [...new Set((slots ?? []).map((slot) => cityDay(slot.startsAt)))], [slots]);
  const daySlots = (slots ?? []).filter((slot) => cityDay(slot.startsAt) === day);
  const chosen = (slots ?? []).find((slot) => slot.id === slotId) ?? null;
  const dayLabel = (key: string) =>
    new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: CITY_TIME_ZONE }).format(new Date(`${key}T12:00:00Z`));
  const clock = (iso: string) => new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: CITY_TIME_ZONE }).format(new Date(iso));

  const book = async () => {
    if (!chosen) return;
    if (reason.trim().length < 10) {
      setReasonError(true);
      return;
    }
    setBusy(true);
    try {
      const response = await apiFetch<{ data: AppointmentDto }>("/api/appointments", {
        method: "POST",
        body: JSON.stringify({ slotId: chosen.id, reason, remindDayBefore: remindDay, remindHourBefore: remindHour }),
      });
      router.push(`/appointments/${response.data.reference}?booked=1`);
    } catch (error) {
      toast.error(describeApiError(error, t));
      // Taken in the meantime: show the slots as they are now.
      if (error instanceof ApiRequestError && error.status === 409) {
        setSlotId(null);
        setReload((value) => value + 1);
      }
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="booking-step-1" className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-5 shadow-panel">
        <h2 id="booking-step-1" className="font-semibold">{t("tn.appointments.step.slot")}</h2>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="booking-service">{t("tn.appointments.service")}</Label>
          <select id="booking-service" value={service} onChange={(event) => setService(event.target.value)} className={FIELD}>
            <option value="">{t("tn.appointments.any_service")}</option>
            {services.map((option) => (
              <option key={option.slug} value={option.slug}>
                {option.name}
              </option>
            ))}
          </select>
        </div>

        {slots === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t("common.loading")}
          </p>
        ) : slots.length === 0 ? (
          <p className="rounded-xl bg-surface-muted p-3 text-sm">{t("tn.appointments.no_slots")}</p>
        ) : (
          <>
            <div role="radiogroup" aria-label={t("tn.appointments.day")} className="flex gap-2 overflow-x-auto pb-1">
              {days.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={day === key}
                  onClick={() => {
                    setDay(key);
                    setSlotId(null);
                  }}
                  className={cn("shrink-0 rounded-xl border px-3 py-2 text-sm font-medium capitalize", day === key ? "border-primary bg-accent text-accent-foreground" : "border-border hover:bg-surface-muted")}
                >
                  {dayLabel(key)}
                </button>
              ))}
            </div>
            <p className="text-[0.8125rem] text-muted-foreground">{t("tn.appointments.time_zone")}</p>
            <ul role="radiogroup" aria-label={t("tn.appointments.time")} className="grid gap-2 sm:grid-cols-2">
              {daySlots.map((slot) => (
                <li key={slot.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={slotId === slot.id}
                    onClick={() => setSlotId(slot.id)}
                    className={cn("flex w-full flex-col gap-0.5 rounded-xl border p-3 text-left text-sm", slotId === slot.id ? "border-primary bg-accent" : "border-border hover:bg-surface-muted")}
                  >
                    <span className="font-semibold tabular-nums">
                      {clock(slot.startsAt)}–{clock(slot.endsAt)} <span className="font-normal text-muted-foreground">· {t("tn.appointments.minutes", { count: slot.durationMinutes })}</span>
                    </span>
                    <span className="flex items-center gap-1 text-[0.8125rem] text-muted-foreground">
                      {slot.mode === "PHONE" ? <Phone className="size-3.5" aria-hidden /> : <MapPin className="size-3.5" aria-hidden />}
                      {slot.mode === "PHONE" ? t("tn.appointments.by_phone") : slot.location}
                    </span>
                    <span className="flex items-center gap-1 text-[0.8125rem] text-muted-foreground">
                      <UserRound className="size-3.5" aria-hidden />
                      {slot.agentName}
                      {slot.service ? ` · ${slot.service.name}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {chosen ? (
        <section aria-labelledby="booking-step-2" className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-panel">
          <h2 id="booking-step-2" className="font-semibold">{t("tn.appointments.step.details")}</h2>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="booking-reason">{t("tn.appointments.reason")}</Label>
            <Textarea
              id="booking-reason"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setReasonError(false);
              }}
              rows={3}
              maxLength={1000}
              placeholder={t("tn.appointments.reason_placeholder")}
              aria-invalid={reasonError || undefined}
            />
            {reasonError ? <p className="text-[0.8125rem] text-error">{t("tn.appointments.reason_error")}</p> : <p className="text-[0.75rem] text-muted-foreground">{t("tn.appointments.reason_hint")}</p>}
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t("tn.appointments.reminders")}</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={remindDay} onChange={(event) => setRemindDay(event.target.checked)} />
              {t("tn.appointments.remind_day")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={remindHour} onChange={(event) => setRemindHour(event.target.checked)} />
              {t("tn.appointments.remind_hour")}
            </label>
          </fieldset>

          <div className="flex flex-col gap-1.5 rounded-xl border border-primary/30 bg-accent/50 p-4 text-[0.9375rem]">
            <p className="text-[0.75rem] font-semibold uppercase tracking-wide text-muted-foreground">{t("tn.appointments.summary")}</p>
            <p className="font-semibold first-letter:uppercase">{formatSlot(chosen.startsAt, chosen.endsAt, lang)}</p>
            <p>
              {t("tn.appointments.minutes", { count: chosen.durationMinutes })} · {chosen.mode === "PHONE" ? t("tn.appointments.by_phone_long") : chosen.location}
            </p>
            <p>
              {t("tn.appointments.with", { name: chosen.agentName })}
              {chosen.service ? ` · ${chosen.service.name}` : ""}
            </p>
          </div>
          <Button onClick={() => void book()} disabled={busy} className="w-fit">
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <CalendarCheck2 aria-hidden />}
            {t("tn.appointments.confirm")}
          </Button>
        </section>
      ) : null}
    </div>
  );
}
