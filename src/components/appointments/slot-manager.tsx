"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { useI18n, useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "@/components/ui/link";
import { apiFetch, ApiRequestError } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import type { AgentSlotDto } from "@/modules/appointments/appointments.dto";
import { CITY_TIME_ZONE, SLOT_DURATIONS, cityDay } from "@/modules/appointments/appointments.time";

const FIELD = "h-10 w-full rounded-[var(--radius-control)] border border-input bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

/**
 * F39 — an agent opens slots for a day (cut into equal lengths) and sees each
 * slot of the coming days, free or booked. A free slot can be withdrawn; a
 * booked one is cancelled from its appointment, so the resident is told.
 */
export function SlotManager({ slots, services }: { readonly slots: readonly AgentSlotDto[]; readonly services: readonly { slug: string; name: string }[] }) {
  const t = useTranslation();
  const { locale } = useI18n();
  const tag = locale === "en" ? "en-GB" : "fr-FR";
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ date: today, from: "09:00", to: "12:00", duration: "30", mode: "IN_PERSON", location: "", serviceSlug: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const open = async (event: FormEvent) => {
    event.preventDefault();
    setBusy("open");
    setFields({});
    try {
      const response = await apiFetch<{ data: { created: number; skipped: number } }>("/api/agent-slots", { method: "POST", body: JSON.stringify({ ...form, duration: Number(form.duration) }) });
      toast.success(t("tn.appointments.slots_opened", { created: response.data.created, skipped: response.data.skipped }));
      router.refresh();
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields) setFields(error.fields);
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    setBusy(id);
    try {
      await apiFetch(`/api/agent-slots/${encodeURIComponent(id)}`, { method: "DELETE" });
      router.refresh();
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(null);
    }
  };

  const clock = (iso: string) => new Intl.DateTimeFormat(tag, { hour: "2-digit", minute: "2-digit", timeZone: CITY_TIME_ZONE }).format(new Date(iso));
  const dayTitle = (key: string) => new Intl.DateTimeFormat(tag, { weekday: "long", day: "numeric", month: "long", timeZone: CITY_TIME_ZONE }).format(new Date(`${key}T12:00:00Z`));
  const byDay = new Map<string, AgentSlotDto[]>();
  for (const slot of slots) byDay.set(cityDay(slot.startsAt), [...(byDay.get(cityDay(slot.startsAt)) ?? []), slot]);
  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={open} className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-panel" noValidate>
        <h2 className="font-semibold">{t("tn.appointments.open_title")}</h2>
        <p className="text-[0.8125rem] text-muted-foreground">{t("tn.appointments.time_zone")}</p>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slot-date">{t("tn.appointments.day")}</Label>
            <Input id="slot-date" type="date" min={today} value={form.date} onChange={(event) => set("date")(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slot-from">{t("tn.appointments.from")}</Label>
            <Input id="slot-from" type="time" step={300} value={form.from} onChange={(event) => set("from")(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slot-to">{t("tn.appointments.to")}</Label>
            <Input id="slot-to" type="time" step={300} value={form.to} onChange={(event) => set("to")(event.target.value)} aria-invalid={fields.to ? true : undefined} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slot-duration">{t("tn.appointments.length")}</Label>
            <select id="slot-duration" value={form.duration} onChange={(event) => set("duration")(event.target.value)} className={FIELD}>
              {SLOT_DURATIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {t("tn.appointments.minutes", { count: minutes })}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slot-mode">{t("tn.appointments.mode")}</Label>
            <select id="slot-mode" value={form.mode} onChange={(event) => set("mode")(event.target.value)} className={FIELD}>
              <option value="IN_PERSON">{t("tn.appointments.in_person")}</option>
              <option value="PHONE">{t("tn.appointments.by_phone")}</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slot-location">{t("tn.appointments.location")}</Label>
            <Input id="slot-location" value={form.location} onChange={(event) => set("location")(event.target.value)} maxLength={200} placeholder={t("tn.appointments.location_placeholder")} aria-invalid={fields.location ? true : undefined} />
            {fields.location ? <p className="text-[0.75rem] text-error">{t("tn.appointments.location_error")}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slot-service">{t("tn.appointments.service")}</Label>
            <select id="slot-service" value={form.serviceSlug} onChange={(event) => set("serviceSlug")(event.target.value)} className={FIELD}>
              <option value="">{t("tn.appointments.any_service")}</option>
              {services.map((service) => (
                <option key={service.slug} value={service.slug}>
                  {service.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button type="submit" disabled={busy === "open"} className="w-fit">
          {busy === "open" ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
          {t("tn.appointments.open_submit")}
        </Button>
      </form>

      <section aria-labelledby="my-slots" className="flex flex-col gap-3">
        <h2 id="my-slots" className="px-1 font-semibold">{t("tn.appointments.my_slots")}</h2>
        {byDay.size === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{t("tn.appointments.no_my_slots")}</p>
        ) : (
          [...byDay.entries()].map(([key, items]) => (
            <div key={key} className="flex flex-col gap-2">
              <h3 className="px-1 text-[0.8125rem] font-semibold uppercase tracking-wide text-muted-foreground">{dayTitle(key)}</h3>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((slot) => (
                  <li key={slot.id} className={cn("flex items-center gap-2 rounded-xl border p-3 text-sm", slot.booking ? "border-primary/40 bg-accent/50" : "border-border bg-card")}>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-semibold tabular-nums">
                        {clock(slot.startsAt)}–{clock(slot.endsAt)}
                      </span>
                      {slot.booking ? (
                        <Link href={`/agent/appointments/${slot.booking.reference}`} className="truncate text-primary underline underline-offset-2">
                          {slot.booking.citizenName} · {slot.booking.reference}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{t("tn.appointments.free")}</span>
                      )}
                    </span>
                    {!slot.booking ? (
                      <button type="button" onClick={() => void remove(slot.id)} disabled={busy === slot.id} aria-label={t("tn.appointments.remove_slot")} className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-error">
                        {busy === slot.id ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
