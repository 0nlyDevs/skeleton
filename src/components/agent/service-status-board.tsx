"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ServiceAvailabilityBadge } from "@/components/city/service-availability-notice";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { useFormatters } from "@/hooks/use-formatters";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";

import { ServiceStatusDialog, type StatusService } from "./service-status-dialog";

/**
 * F38 — the agents' view of every open service: which ones are stopped or
 * announced, and one click to report, update or close an interruption.
 */
export function ServiceStatusBoard({ services }: { readonly services: readonly StatusService[] }) {
  const t = useTranslation();
  const fmt = useFormatters();
  const router = useRouter();
  const [editing, setEditing] = useState<StatusService | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  const restore = async (service: StatusService) => {
    setRestoring(service.slug);
    try {
      await apiFetch(`/api/city-services/${encodeURIComponent(service.slug)}/availability`, { method: "PUT", body: JSON.stringify({ availability: "AVAILABLE" }) });
      toast.success(t("tn.availability.restored", { service: service.name }));
      router.refresh();
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setRestoring(null);
    }
  };

  const disrupted = services.filter((service) => service.availability.state !== "AVAILABLE");
  const ordered = [...disrupted, ...services.filter((service) => service.availability.state === "AVAILABLE")];

  return (
    <>
      <p className="px-1 text-sm text-muted-foreground">
        {disrupted.length === 0 ? t("tn.availability.board.all_ok") : t("tn.availability.board.count", { count: disrupted.length })}
      </p>
      <ul className="flex flex-col divide-y divide-border/60 rounded-2xl border border-border/70 bg-card shadow-panel">
        {ordered.map((service) => {
          const state = service.availability.state;
          return (
            <li key={service.slug} className="flex flex-wrap items-center gap-3 p-4">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2 font-semibold">
                  {service.name}
                  {state === "AVAILABLE" ? (
                    <span className="inline-flex items-center gap-1 text-[0.75rem] font-medium text-success">
                      <CheckCircle2 className="size-3.5" aria-hidden />
                      {t("tn.availability.badge.ok")}
                    </span>
                  ) : (
                    <ServiceAvailabilityBadge availability={service.availability} />
                  )}
                </span>
                {service.availability.note ? <span className="text-[0.8438rem] text-muted-foreground">{service.availability.note}</span> : null}
                {service.availability.until ? (
                  <span className="text-[0.7812rem] text-muted-foreground">{t("tn.availability.board.until", { until: fmt.dateTime(service.availability.until) })}</span>
                ) : null}
              </div>
              <div className="flex gap-2">
                {state !== "AVAILABLE" ? (
                  <Button size="sm" variant="secondary" onClick={() => void restore(service)} disabled={restoring === service.slug}>
                    {restoring === service.slug ? <Loader2 className="animate-spin" aria-hidden /> : null}
                    {t("tn.availability.board.restore")}
                  </Button>
                ) : null}
                <Button size="sm" variant={state === "AVAILABLE" ? "secondary" : "primary"} onClick={() => setEditing(service)}>
                  {t(state === "AVAILABLE" ? "tn.availability.board.report" : "tn.availability.board.edit")}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {editing ? (
        <ServiceStatusDialog
          key={editing.slug}
          service={editing}
          alternatives={services.filter((service) => service.slug !== editing.slug && service.availability.state === "AVAILABLE")}
          open
          onOpenChange={(open) => (open ? null : setEditing(null))}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </>
  );
}
