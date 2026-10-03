"use client";

import { ArrowRight, Siren } from "lucide-react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "@/components/ui/link";
import type { CityAlertDto } from "@/modules/alerts/alerts.service";
import type { CityZoneId } from "@/modules/alerts/city-zones";

import { AlertCard } from "./alert-card";
import { useCityAlerts } from "./use-city-alerts";

/** Active alerts at the top of the feed: the viewer's own first, then problems elsewhere in the city. */
export function AlertFeedHighlights({ initial, viewerZone }: { readonly initial: readonly CityAlertDto[]; readonly viewerZone: CityZoneId | null }) {
  const t = useTranslation();
  const { alerts: all } = useCityAlerts(initial);
  const alerts = all.filter((alert) => alert.alert.status === "ACTIVE");
  if (alerts.length === 0) return null;

  return (
    <Card className="overflow-hidden border-primary/20">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Siren className="size-[18px]" aria-hidden />
          </span>
          <div>
            <CardTitle className="text-base">{t("alerts.feed.heading")}</CardTitle>
            <p className="mt-1 text-[0.7812rem] leading-relaxed text-muted-foreground">{t("alerts.feed.subtitle")}</p>
          </div>
        </div>
        <Button asChild variant="ghost" size="sm" className="shrink-0">
          <Link href="/alerts">{t("alerts.title")}<ArrowRight aria-hidden /></Link>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {alerts.slice(0, 3).map((alert) => <AlertCard key={alert.id} alert={alert} compact viewerZone={viewerZone} />)}
      </CardContent>
    </Card>
  );
}
