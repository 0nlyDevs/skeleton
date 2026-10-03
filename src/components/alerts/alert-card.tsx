"use client";

import { ArrowUpRight, Check, Info, MapPin, ShieldAlert, TriangleAlert } from "lucide-react";

import { useTranslation } from "@/components/providers/i18n-provider";
import Link from "@/components/ui/link";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { CityAlertDto } from "@/modules/alerts/alerts.service";
import { alertTargetsZone, cityAlertScopeLabelKey, type CityZoneId } from "@/modules/alerts/city-zones";

const severityPresentation = {
  INFORMATION: { Icon: Info, color: "text-blue-700 dark:text-blue-300", border: "border-blue-500/25", fill: "bg-blue-500/10" },
  WARNING: { Icon: TriangleAlert, color: "text-amber-800 dark:text-amber-300", border: "border-amber-500/30", fill: "bg-amber-500/10" },
  CRITICAL: { Icon: ShieldAlert, color: "text-red-800 dark:text-red-300", border: "border-red-500/35", fill: "bg-red-500/10" },
} as const;

export function AlertCard({
  alert,
  compact = false,
  viewerZone = null,
}: {
  readonly alert: CityAlertDto;
  readonly compact?: boolean;
  readonly viewerZone?: CityZoneId | null;
}) {
  const t = useTranslation();
  const presentation = severityPresentation[alert.alert.severity];
  const Icon = alert.alert.status === "RESOLVED" ? Check : presentation.Icon;

  return (
    <article className={cn("rounded-2xl border bg-card shadow-panel", presentation.border, alert.alert.status === "RESOLVED" && "opacity-80")}>
      <Link href={`/alerts/${encodeURIComponent(alert.slug)}`} className="group block rounded-2xl p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
        <div className="flex items-start gap-3">
          <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl", presentation.fill, presentation.color)}>
            <Icon className="size-[18px]" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("text-[0.6875rem] font-semibold", presentation.color)}>
                {t(`alerts.severity.${alert.alert.severity}` as MessageKey)}
              </span>
              {viewerZone ? (
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
                  {alertTargetsZone(alert.alert.scope, viewerZone) ? t("alerts.affects_you") : t("alerts.feed.elsewhere", { zone: t(cityAlertScopeLabelKey(alert.alert.scope)) })}
                </span>
              ) : null}
              {alert.alert.status === "RESOLVED" ? (
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
                  {t("alerts.status.RESOLVED")}
                </span>
              ) : null}
            </div>
            <h2 className="mt-1 text-[0.9688rem] font-semibold leading-snug text-foreground group-hover:text-primary">
              {alert.title}
            </h2>
            <p className={cn("mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground", compact && "line-clamp-2")}>
              {alert.summary}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.7188rem] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" aria-hidden />
                {t(cityAlertScopeLabelKey(alert.alert.scope))}
              </span>
              {alert.publishedAt ? <time dateTime={alert.publishedAt}>{new Date(alert.publishedAt).toLocaleString()}</time> : null}
              <span className="inline-flex items-center gap-1 font-semibold text-primary">
                {t("alerts.open")} <ArrowUpRight className="size-3.5" aria-hidden />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
