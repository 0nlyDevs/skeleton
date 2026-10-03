"use client";

import { CalendarClock, MapPin, Phone } from "lucide-react";

import { useI18n, useTranslation } from "@/components/providers/i18n-provider";
import Link from "@/components/ui/link";
import { cn } from "@/lib/utils";
import type { AppointmentDto } from "@/modules/appointments/appointments.dto";
import { formatSlot } from "@/modules/appointments/appointments.time";

/** Upcoming appointments first, then past and cancelled ones, each with its full slot. */
export function AppointmentList({
  appointments,
  hrefBase,
  viewer,
  emptyText,
}: {
  readonly appointments: readonly AppointmentDto[];
  readonly hrefBase: "/appointments" | "/agent/appointments";
  readonly viewer: "citizen" | "agent";
  readonly emptyText: string;
}) {
  const t = useTranslation();
  const { locale } = useI18n();
  const lang = locale === "en" ? "en" : "fr";
  if (appointments.length === 0) return <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{emptyText}</p>;

  return (
    <ul className="flex flex-col gap-2.5">
      {appointments.map((appointment) => (
        <li key={appointment.reference}>
          <Link
            href={`${hrefBase}/${appointment.reference}`}
            className={cn(
              "flex gap-3 rounded-2xl border bg-card p-4 shadow-panel transition-colors hover:border-primary/40",
              appointment.upcoming ? "border-border/70" : "border-border/40 opacity-80",
            )}
          >
            <CalendarClock className={cn("mt-0.5 size-5 shrink-0", appointment.upcoming ? "text-primary" : "text-muted-foreground")} aria-hidden />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-semibold first-letter:uppercase">{formatSlot(appointment.startsAt, appointment.endsAt, lang)}</span>
              <span className="flex items-center gap-1 text-[0.8438rem] text-muted-foreground">
                {appointment.mode === "PHONE" ? <Phone className="size-3.5" aria-hidden /> : <MapPin className="size-3.5" aria-hidden />}
                {appointment.mode === "PHONE" ? t("tn.appointments.by_phone") : appointment.location}
                {" · "}
                {viewer === "citizen" ? appointment.agent.name : appointment.citizen.name}
                {appointment.service ? ` · ${appointment.service.name}` : ""}
              </span>
            </span>
            <span className="shrink-0 text-[0.75rem] font-semibold text-muted-foreground">
              {appointment.upcoming ? appointment.reference : t(`tn.appointments.status.${appointment.status}`)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
