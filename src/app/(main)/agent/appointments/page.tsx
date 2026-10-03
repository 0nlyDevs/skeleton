import type { Metadata } from "next";

import { withAgentAccess } from "@/components/agent/agent-guard";
import { AppointmentList } from "@/components/appointments/appointment-list";
import { SlotManager } from "@/components/appointments/slot-manager";
import { getServerDictionary } from "@/lib/i18n/server";
import { listAgentAppointments } from "@/modules/appointments/appointments.service";
import { listMySlots } from "@/modules/appointments/appointments.slots";
import { listServices } from "@/modules/city-services/city-services.service";

export const metadata: Metadata = { title: "Rendez-vous — agents" };

/** F39 — agents open slots and follow their appointments. */
export default async function AgentAppointmentsPage() {
  return withAgentAccess("/agent/appointments", async (user) => {
    const { t, locale } = await getServerDictionary();
    const [slots, appointments, services] = await Promise.all([listMySlots(user), listAgentAppointments(user), listServices({}, user, locale)]);
    return (
      <div className="flex flex-col gap-5">
        <header className="flex flex-col gap-1 px-1">
          <h1 className="text-xl font-semibold tracking-tight">{t("tn.appointments.agent_title")}</h1>
          <p className="text-sm text-muted-foreground">{t("tn.appointments.agent_subtitle")}</p>
        </header>
        <section aria-labelledby="agent-appointments" className="flex flex-col gap-3">
          <h2 id="agent-appointments" className="px-1 font-semibold">{t("tn.appointments.upcoming")}</h2>
          <AppointmentList appointments={appointments} hrefBase="/agent/appointments" viewer="agent" emptyText={t("tn.appointments.agent_empty")} />
        </section>
        <SlotManager slots={slots} services={services.filter((service) => service.active).map(({ slug, name }) => ({ slug, name }))} />
      </div>
    );
  });
}
