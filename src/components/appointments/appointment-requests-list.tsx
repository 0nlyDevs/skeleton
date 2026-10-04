"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useI18n } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import type { MessageKey } from "@/lib/i18n";
import { formatSlot } from "@/modules/appointments/appointments.time";
import type { AppointmentRequestDto } from "@/modules/appointments/appointment-requests.service";

/** The resident's requests and what became of each: waiting, accepted (with the appointment), declined (with the reason). */
export function AppointmentRequestsList({ requests }: { readonly requests: readonly AppointmentRequestDto[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  if (requests.length === 0) return null;

  const withdraw = async (reference: string) => {
    setBusy(reference);
    try {
      await apiFetch(`/api/appointment-requests/${reference}`, { method: "DELETE" });
      toast.success(t("tn.appointments.request.withdrawn"));
      router.refresh();
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section id="requests" aria-labelledby="my-requests-title" className="flex scroll-mt-24 flex-col gap-3">
      <h2 id="my-requests-title" className="px-1 text-lg font-semibold">{t("tn.appointments.request.mine")}</h2>
      <ul className="flex flex-col gap-3">
        {requests.map((request) => (
          <li key={request.reference} className="flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-panel">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={request.status === "ACCEPTED" ? "success" : request.status === "DECLINED" ? "error" : "neutral"}>
                <span className="state-bubble" data-fill={request.status === "PENDING" ? "ring" : request.status === "ACCEPTED" ? "full" : "closed"} aria-hidden />
                {t(`tn.appointments.request.status.${request.status}` as MessageKey)}
              </Badge>
              <span className="ml-auto font-mono text-[0.75rem] text-muted-foreground">{request.reference}</span>
            </div>
            <p className="font-semibold">{formatSlot(request.preferredStart, request.preferredEnd, locale)}</p>
            {request.service ? <p className="text-[0.8125rem] text-muted-foreground">{request.service.name}</p> : null}
            {request.status === "ACCEPTED" && request.appointmentRef ? (
              <Link href={`/appointments/${request.appointmentRef}`} className="w-fit text-sm font-medium text-primary">{t("tn.appointments.request.see_appointment", { reference: request.appointmentRef })}</Link>
            ) : null}
            {request.status === "DECLINED" && request.answer ? (
              <p className="rounded-xl bg-surface-muted px-3 py-2 text-sm"><span className="font-semibold">{t("tn.appointments.request.reason_declined")} </span>{request.answer}</p>
            ) : null}
            {request.status === "PENDING" ? (
              <Button type="button" size="sm" variant="secondary" className="w-fit" disabled={busy === request.reference} onClick={() => void withdraw(request.reference)}>
                {t("tn.appointments.request.withdraw")}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
