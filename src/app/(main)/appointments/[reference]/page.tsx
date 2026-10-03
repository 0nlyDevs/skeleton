import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppointmentView } from "@/components/appointments/appointment-view";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { requirePageAuth } from "@/lib/auth/page-guards";
import { getServerDictionary } from "@/lib/i18n/server";
import { getAppointment } from "@/modules/appointments/appointments.service";
import { appointmentReferenceParamSchema } from "@/modules/appointments/appointments.schema";

export const metadata: Metadata = { title: "Rendez-vous" };

export default async function AppointmentPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ reference: string }>;
  readonly searchParams: Promise<{ booked?: string }>;
}) {
  const parsed = appointmentReferenceParamSchema.safeParse(await params);
  if (!parsed.success) notFound();
  const { user } = await requirePageAuth(`/appointments/${parsed.data.reference}`);
  const { t } = await getServerDictionary();
  const result = await getAppointment(parsed.data.reference, user).catch(() => null);
  if (!result) notFound();
  const { booked } = await searchParams;
  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
      <Breadcrumbs label={t("tn.breadcrumb.label")} items={[{ label: t("tn.appointments.title"), href: "/appointments" }, { label: result.appointment.reference }]} />
      <AppointmentView appointment={result.appointment} preparation={result.preparation} viewer={result.appointment.citizen.id === user.id ? "citizen" : "agent"} justBooked={booked === "1"} />
    </div>
  );
}
