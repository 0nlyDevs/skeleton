"use client";

import { CheckCircle2, LockKeyhole, ShieldAlert, ShieldCheck, TriangleAlert } from "lucide-react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { useFormatters } from "@/hooks/use-formatters";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LoginProtectionOverview, ProtectionStatus } from "@/modules/login-protection/login-protection.stats";

const STATUS_STYLE: Record<ProtectionStatus, { icon: typeof ShieldCheck; tone: string }> = {
  NORMAL: { icon: ShieldCheck, tone: "border-success/30 bg-success/8 text-success" },
  ELEVATED: { icon: TriangleAlert, tone: "border-warning/40 bg-warning/10 text-warning" },
  ATTACK: { icon: ShieldAlert, tone: "border-error/40 bg-error/10 text-error" },
};

function Figure({ label, value, hint }: { readonly label: string; readonly value: number; readonly hint?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-[0.8125rem] font-medium text-muted-foreground">{label}</span>
        <span className="text-[1.625rem] font-semibold leading-none tabular-nums">{value.toLocaleString()}</span>
        {hint ? <span className="text-[0.75rem] text-muted-foreground">{hint}</span> : null}
      </CardContent>
    </Card>
  );
}

/**
 * Sign-in protection for administrators: is a wave under way right now, how
 * many accounts and sources are involved, and what the limiter already
 * blocked. Addresses are truncated; identifiers matching no account are never
 * shown, only counted.
 */
export function LoginProtectionView({ data }: { readonly data: LoginProtectionOverview }) {
  const t = useTranslation();
  const fmt = useFormatters();
  const status = STATUS_STYLE[data.status];
  const StatusIcon = status.icon;
  const peak = Math.max(1, ...data.hourly);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-[1.5rem] font-semibold tracking-[-0.015em]">{t("tn.admin.security.title")}</h1>
        <p className="text-[0.875rem] text-muted-foreground">{t("tn.admin.security.subtitle")}</p>
      </header>

      <div role="status" className={cn("flex items-start gap-3 rounded-xl border p-4", status.tone)}>
        <StatusIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="flex flex-col gap-1 text-foreground">
          <p className="font-semibold">{t(`tn.admin.security.status.${data.status}`)}</p>
          <p className="text-[0.8438rem] text-muted-foreground">
            {t("tn.admin.security.last_hour", {
              failures: data.lastHour.failures,
              accounts: data.lastHour.accounts,
              sources: data.lastHour.sources,
            })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Figure label={t("tn.admin.security.failures")} value={data.last24h.failures} hint={t("tn.admin.security.day")} />
        <Figure label={t("tn.admin.security.accounts")} value={data.last24h.accounts} hint={t("tn.admin.security.day")} />
        <Figure label={t("tn.admin.security.locks")} value={data.last24h.locks} hint={t("tn.admin.security.day")} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("tn.admin.security.chart")}</CardTitle>
          <CardDescription>{t("tn.admin.security.chart_hint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-28 items-end gap-1" role="img" aria-label={t("tn.admin.security.chart")}>
            {data.hourly.map((count, index) => (
              <span
                key={index}
                title={String(count)}
                className={cn("flex-1 rounded-t-sm", count > 0 ? "bg-warning/70" : "bg-border/70")}
                style={{ height: `${Math.max(4, (count / peak) * 100)}%` }}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[0.6875rem] text-muted-foreground">
            <span>{t("tn.admin.security.chart_start")}</span>
            <span>{t("tn.admin.security.chart_now")}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("tn.admin.security.sources")}</CardTitle>
            <CardDescription>{t("tn.admin.security.sources_hint")}</CardDescription>
          </CardHeader>
          <CardContent>
            {data.sources.length === 0 ? (
              <p className="flex items-center gap-2 text-[0.8438rem] text-muted-foreground">
                <CheckCircle2 className="size-4 text-success" aria-hidden />
                {t("tn.admin.security.none")}
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border/60">
                {data.sources.map((source) => (
                  <li key={source.ip} className="flex items-center justify-between gap-3 py-2 text-[0.8438rem]">
                    <span className="font-mono">{source.ip}</span>
                    <span className="text-muted-foreground">
                      {t("tn.admin.security.source_line", { failures: source.failures, accounts: source.accounts })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("tn.admin.security.recent")}</CardTitle>
            <CardDescription>{t("tn.admin.security.recent_hint")}</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recent.length === 0 ? (
              <p className="flex items-center gap-2 text-[0.8438rem] text-muted-foreground">
                <CheckCircle2 className="size-4 text-success" aria-hidden />
                {t("tn.admin.security.none")}
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border/60">
                {data.recent.map((event) => (
                  <li key={event.id} className="flex items-center gap-3 py-2 text-[0.8125rem]">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {event.account
                          ? `${event.account.name}${event.account.username ? ` · @${event.account.username}` : ""}`
                          : t("tn.admin.security.unknown_account")}
                      </span>
                      <span className="text-muted-foreground">
                        {fmt.relative(event.at)} · <span className="font-mono">{event.ip}</span>
                      </span>
                    </span>
                    {event.locked ? (
                      <Badge variant="warning" className="gap-1">
                        <LockKeyhole className="size-3" aria-hidden />
                        {t("tn.security.failed_locked")}
                      </Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("tn.admin.security.rules")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[0.8438rem] leading-relaxed">
            <li>{t("tn.admin.security.rule_account")}</li>
            <li>{t("tn.admin.security.rule_ip")}</li>
            <li>{t("tn.admin.security.rule_owner")}</li>
            <li>{t("tn.admin.security.rule_enumeration")}</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
