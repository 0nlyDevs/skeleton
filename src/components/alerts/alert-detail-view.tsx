"use client";

import { ArrowLeft, MapPin, ShieldAlert, Siren } from "lucide-react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { AlertGuidance } from "@/components/alerts/alert-guidance";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "@/components/ui/link";
import { useFormatters } from "@/hooks/use-formatters";
import type { MessageKey } from "@/lib/i18n";
import type { CityAlertDto } from "@/modules/alerts/alerts.service";
import { cityAlertScopeLabelKey, type CityZoneId } from "@/modules/alerts/city-zones";

const levelStyles = {
  INFORMATION: "border-blue-500/30 bg-blue-500/10 text-blue-800 dark:text-blue-300",
  WARNING: "border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-300",
  CRITICAL: "border-red-500/35 bg-red-500/10 text-red-900 dark:text-red-300",
} as const;

export function AlertDetailView({
  alert,
  viewerZone,
  authenticated,
}: {
  readonly alert: CityAlertDto;
  readonly viewerZone: CityZoneId | null;
  readonly authenticated: boolean;
}) {
  const t = useTranslation();
  const fmt = useFormatters();
  const severity = t(`alerts.severity.${alert.alert.severity}` as MessageKey);
  const mapHref = alert.alert.scope === "ALL" ? "/city-map" : `/city-map?zone=${encodeURIComponent(alert.alert.scope)}`;

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
      <Button asChild variant="ghost" className="self-start"><Link href="/alerts"><ArrowLeft aria-hidden />{t("alerts.back")}</Link></Button>
      <Card className="overflow-hidden">
        <div className={`border-b px-5 py-4 sm:px-7 ${levelStyles[alert.alert.severity]}`}>
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <ShieldAlert className="size-4" aria-hidden />
            <span>{severity}</span>
            <span aria-hidden>·</span>
            <span>{t(`alerts.status.${alert.alert.status}` as MessageKey)}</span>
          </div>
        </div>
        <article className="p-5 sm:p-7">
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" aria-hidden />{t(cityAlertScopeLabelKey(alert.alert.scope))}</span>
            {alert.publishedAt ? <time dateTime={alert.publishedAt}>{t("alerts.detail.reported")} {fmt.dateTime(alert.publishedAt)}</time> : null}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{alert.title}</h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{alert.summary}</p>
          <div className="mt-7 border-t border-border/70 pt-6">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold"><Siren className="size-[18px] text-primary" aria-hidden />{t("alerts.detail.actions")}</h2>
            <div className="whitespace-pre-line text-[0.9375rem] leading-7 text-foreground/90">{alert.body}</div>
          </div>
          <div className="mt-7 flex flex-wrap gap-3 border-t border-border/70 pt-5">
            <Button asChild variant="secondary"><Link href={mapHref}><MapPin aria-hidden />{t("alerts.map.title")}</Link></Button>
            <Button asChild variant="ghost"><Link href="/feed">{t("alerts.feed.heading")}</Link></Button>
          </div>
        </article>
      </Card>
      <AlertGuidance slug={alert.slug} viewerZone={viewerZone} authenticated={authenticated} />
    </div>
  );
}
