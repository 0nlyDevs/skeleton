import { CalendarPlus } from "lucide-react";
import type { Metadata } from "next";

import { AppointmentRequestsList } from "@/components/appointments/appointment-requests-list";
import { AppointmentList } from "@/components/appointments/appointment-list";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { requirePageAuth } from "@/lib/auth/page-guards";
import { getServerDictionary } from "@/lib/i18n/server";
import { listMyAppointmentRequests } from "@/modules/appointments/appointment-requests.service";
import { listMyAppointments } from "@/modules/appointments/appointments.service";

export const metadata: Metadata = { title: "Mes rendez-vous" };

/** F39 — the resident's appointments with city agents. */
export default async function AppointmentsPage() {
  const { user } = await requirePageAuth("/appointments");
  const { t } = await getServerDictionary();
  const [appointments, requests] = await Promise.all([listMyAppointments(user), listMyAppointmentRequests(user)]);
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("tn.appointments.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("tn.appointments.subtitle")}</p>
        </div>
        <Button asChild>
          <Link href="/appointments/new">
            <CalendarPlus aria-hidden />
            {t("tn.appointments.new")}
          </Link>
        </Button>
      </header>
      <AppointmentRequestsList requests={requests} />
      <AppointmentList appointments={appointments} hrefBase="/appointments" viewer="citizen" emptyText={t("tn.appointments.empty")} />
    </div>
  );
}
