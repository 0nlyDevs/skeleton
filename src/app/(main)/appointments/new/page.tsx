import type { Metadata } from "next";

import { AppointmentRequestForm } from "@/components/appointments/appointment-request-form";
import { AppointmentBooking } from "@/components/appointments/appointment-booking";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { requirePageAuth } from "@/lib/auth/page-guards";
import { getServerDictionary } from "@/lib/i18n/server";
import { listServices } from "@/modules/city-services/city-services.service";

export const metadata: Metadata = { title: "Prendre rendez-vous" };

/** F39 — book an appointment with an agent. */
export default async function NewAppointmentPage({ searchParams }: { readonly searchParams: Promise<{ service?: string }> }) {
  const { service } = await searchParams;
  const { user } = await requirePageAuth(service ? `/appointments/new?service=${encodeURIComponent(service)}` : "/appointments/new");
  const { t, locale } = await getServerDictionary();
  const services = (await listServices({}, user, locale)).filter((item) => item.active);
  const initial = services.some((item) => item.slug === service) ? (service ?? "") : "";
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
      <Breadcrumbs label={t("tn.breadcrumb.label")} items={[{ label: t("tn.appointments.title"), href: "/appointments" }, { label: t("tn.appointments.new") }]} />
      <header className="flex flex-col gap-1 px-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("tn.appointments.new")}</h1>
        <p className="text-sm text-muted-foreground">{t("tn.appointments.new_subtitle")}</p>
      </header>
      <AppointmentBooking services={services.map(({ slug, name }) => ({ slug, name }))} initialService={initial} />
      <AppointmentRequestForm services={services.map(({ slug, name }) => ({ slug, name }))} initialService={initial} />
    </div>
  );
}
