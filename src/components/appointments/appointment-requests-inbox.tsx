"use client";

import { Check, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useI18n } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { formatSlot } from "@/modules/appointments/appointments.time";
import type { AppointmentRequestDto } from "@/modules/appointments/appointment-requests.service";

/**
 * Requests waiting for an agent. Accept (at the asked time, or at another
 * one, with where to go) and the appointment exists at once; decline with a
 * reason the resident reads.
 */
export function AppointmentRequestsInbox({ requests }: { readonly requests: readonly AppointmentRequestDto[] }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState<{ reference: string; kind: "accept" | "decline" } | null>(null);
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const act = async (request: AppointmentRequestDto, kind: "accept" | "decline") => {
    setBusy(true);
    try {
      await apiFetch(`/api/appointment-requests/${request.reference}/${kind}`, {
        method: "POST",
        body: kind === "accept" ? { location: location || null, startsAt: startsAt ? new Date(`${startsAt}:00Z`).toISOString() : null } : { reason },
      });
      toast.success(t(kind === "accept" ? "tn.appointments.request.accepted" : "tn.appointments.request.declined"));
      setOpen(null);
      setLocation("");
      setStartsAt("");
      setReason("");
      router.refresh();
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="requests" aria-labelledby="agent-requests-title" className="flex scroll-mt-24 flex-col gap-3">
      <h2 id="agent-requests-title" className="flex items-center gap-2 px-1 text-lg font-semibold">
        {t("tn.appointments.request.inbox")}
        {requests.length > 0 ? <Badge variant="primary">{requests.length}</Badge> : null}
      </h2>
      {requests.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{t("tn.appointments.request.inbox_empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((request) => (
            <li key={request.reference} className="flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-panel">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{request.citizen?.name ?? "—"}</p>
                <span className="font-mono text-[0.75rem] text-muted-foreground">{request.reference}</span>
              </div>
              <p className="text-[0.9375rem]">
                {formatSlot(request.preferredStart, request.preferredEnd, locale)} · {t(request.mode === "PHONE" ? "tn.appointments.request.phone" : "tn.appointments.request.in_person")}
                {request.service ? ` · ${request.service.name}` : ""}
              </p>
              <p className="prose-body rounded-xl bg-surface-muted px-3 py-2 text-[0.9062rem]">{request.reason}</p>
              {open?.reference === request.reference ? (
                open.kind === "accept" ? (
                  <div className="flex flex-col gap-2 rounded-xl border border-border/70 p-3">
                    {request.mode === "IN_PERSON" ? (
                      <div className="flex flex-col">
                        <Label htmlFor={`loc-${request.reference}`}>{t("tn.appointments.request.where")}</Label>
                        <Input id={`loc-${request.reference}`} value={location} onChange={(event) => setLocation(event.target.value)} maxLength={200} />
                      </div>
                    ) : null}
                    <div className="flex flex-col">
                      <Label htmlFor={`at-${request.reference}`}>{t("tn.appointments.request.other_time")}</Label>
                      <Input id={`at-${request.reference}`} type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" disabled={busy || (request.mode === "IN_PERSON" && !location.trim())} onClick={() => void act(request, "accept")}>
                        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
                        {t("tn.appointments.request.confirm")}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(null)}>{t("common.cancel")}</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 rounded-xl border border-border/70 p-3">
                    <Label htmlFor={`why-${request.reference}`}>{t("tn.appointments.request.why")}</Label>
                    <Input id={`why-${request.reference}`} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} placeholder={t("tn.appointments.request.why_hint")} />
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="destructive" disabled={busy || reason.trim().length < 5} onClick={() => void act(request, "decline")}>
                        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <X aria-hidden />}
                        {t("tn.appointments.request.decline")}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(null)}>{t("common.cancel")}</Button>
                    </div>
                  </div>
                )
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => setOpen({ reference: request.reference, kind: "accept" })}>
                    <Check aria-hidden />
                    {t("tn.appointments.request.accept")}
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setOpen({ reference: request.reference, kind: "decline" })}>
                    <X aria-hidden />
                    {t("tn.appointments.request.decline")}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
