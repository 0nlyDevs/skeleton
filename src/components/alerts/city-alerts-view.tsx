"use client";

import { useState } from "react";
import { Globe2, MapPin, Siren } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import type { CityAlertDto } from "@/modules/alerts/alerts.service";
import { cityZoneLabelKey, type CityZoneId } from "@/modules/alerts/city-zones";

import { AlertCard } from "./alert-card";
import { useCityAlerts } from "./use-city-alerts";

export function CityAlertsView({
  initial,
  isStaff,
  viewerZone,
}: {
  readonly initial: readonly CityAlertDto[];
  readonly isStaff: boolean;
  readonly viewerZone: CityZoneId | null;
}) {
  const t = useTranslation();
  const { alerts, setAlerts } = useCityAlerts(initial);
  const [resolvingSlug, setResolvingSlug] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const resolve = async () => {
    if (!resolvingSlug || busy) return;
    setBusy(true);
    try {
      const response = await apiFetch<{ data: CityAlertDto }>(
        `/api/alerts/${encodeURIComponent(resolvingSlug)}/resolve`,
        { method: "POST", body: {} },
      );
      setAlerts((current) => current.map((alert) => alert.slug === resolvingSlug ? response.data : alert));
      setResolvingSlug(null);
      toast.success(t("alerts.resolved"));
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-[1.5rem] font-semibold tracking-[-0.015em]">{t("alerts.title")}</h1>
          <p className="max-w-2xl text-[0.875rem] text-muted-foreground">{t("alerts.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/city-map"><Globe2 aria-hidden />{t("alerts.map.open_map")}</Link>
          </Button>
          {isStaff ? (
            <Button asChild>
              <Link href="/agent/alerts/new"><Siren aria-hidden />{t("alerts.create")}</Link>
            </Button>
          ) : null}
        </div>
      </header>

      {viewerZone ? (
        <Alert className="border-primary/20 bg-primary/[0.035]">
          <MapPin aria-hidden />
          <AlertDescription>
            {t("alerts.map.my_zone")}: <span className="font-semibold text-foreground">{t(cityZoneLabelKey(viewerZone))}</span>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <MapPin aria-hidden />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{t("alerts.location.required")}</span>
            <Link href="/settings/profile" className="font-semibold text-primary hover:underline">{t("settings.profile.title")}</Link>
          </AlertDescription>
        </Alert>
      )}

      {alerts.length === 0 ? (
        <EmptyState icon={Siren} title={t("alerts.empty.title")} description={t("alerts.empty.body")} />
      ) : (
        <div className="flex flex-col gap-3" aria-live="polite" aria-relevant="additions text">
          {alerts.map((alert) => (
            <div key={alert.id} className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <AlertCard alert={alert} viewerZone={viewerZone} />
              </div>
              {isStaff && alert.alert.status === "ACTIVE" ? (
                <Button variant="secondary" size="sm" className="shrink-0 sm:mt-2" onClick={() => setResolvingSlug(alert.slug)}>
                  {t("alerts.resolve")}
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={resolvingSlug !== null}
        onOpenChange={(open) => !open && !busy && setResolvingSlug(null)}
        title={t("alerts.resolve_confirm")}
        description={t("alerts.resolved")}
        confirmLabel={t("alerts.resolve")}
        busy={busy}
        onConfirm={() => void resolve()}
      />
    </div>
  );
}
