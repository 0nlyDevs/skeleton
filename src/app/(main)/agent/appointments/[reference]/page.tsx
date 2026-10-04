import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { withAgentAccess } from "@/components/agent/agent-guard";
import { AppointmentView } from "@/components/appointments/appointment-view";
import { getAppointment } from "@/modules/appointments/appointments.service";
import { appointmentReferenceParamSchema } from "@/modules/appointments/appointments.schema";

export const metadata: Metadata = { title: "Rendez-vous, agents" };

export default async function AgentAppointmentPage({ params }: { readonly params: Promise<{ reference: string }> }) {
  const parsed = appointmentReferenceParamSchema.safeParse(await params);
  if (!parsed.success) notFound();
  return withAgentAccess(`/agent/appointments/${parsed.data.reference}`, async (user) => {
    const result = await getAppointment(parsed.data.reference, user).catch(() => null);
    if (!result) notFound();
    return <AppointmentView appointment={result.appointment} preparation={result.preparation} viewer="agent" />;
  });
}
