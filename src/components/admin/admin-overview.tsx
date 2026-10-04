"use client";

import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Database,
  FileText,
  LockKeyhole,
  ScrollText,
  ShieldAlert,
  Users,
} from "lucide-react";
import Link from "@/components/ui/link";

import { useTranslation } from "@/components/providers/i18n-provider";
import { useFormatters } from "@/hooks/use-formatters";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes } from "@/lib/utils";
import type { AdminOverview } from "@/modules/stats/stats.service";
import type { ProtectionStatus } from "@/modules/login-protection/login-protection.stats";

/** Sign-in protection summary; admins only, so absent for agents. */
export interface AdminSecuritySummary {
  readonly status: ProtectionStatus;
  readonly failures: number;
  readonly locks: number;
}
import { APP_VERSION } from "@/lib/version";

/**
 * Admin overview.
 *
 * All figures arrive pre-computed from the cached admin aggregate; this component
 * only formats. Each card links to the page where the underlying list lives, so
 * the overview works as a triage surface rather than a dead-end chart wall.
 */
export function AdminOverview({ data, security }: { readonly data: AdminOverview; readonly security?: AdminSecuritySummary | undefined }) {
  const t = useTranslation();
  const fmt = useFormatters();

  const cards = [
    {
      icon: Users,
      label: t("admin.stat.users"),
      value: data.users.total.toLocaleString(),
      hint: t("admin.stat.users_hint", { banned: data.users.banned, verified: data.users.verified }),
      href: "/admin/users",
    },
    {
      icon: FileText,
      label: t("admin.stat.posts"),
      value: data.posts.total.toLocaleString(),
      hint: t("admin.stat.posts_hint", { published: data.posts.published, deleted: data.posts.deleted }),
      href: "/posts",
    },
    {
      icon: ShieldAlert,
      label: t("admin.stat.reports"),
      value: data.reports.open.toLocaleString(),
      href: "/admin/moderation",
      accent: data.reports.open > 0,
    },
    {
      icon: ScrollText,
      label: t("admin.stat.audit"),
      value: data.audit.last24h.toLocaleString(),
      href: "/admin/audit",
    },
    ...(security
      ? [
          {
            icon: LockKeyhole,
            label: t("tn.admin.security.card"),
            value: security.failures.toLocaleString(),
            hint: `${t(`tn.admin.security.status.${security.status}`)} · ${t("tn.admin.security.card_locks", { count: security.locks })}`,
            href: "/admin/security",
            accent: security.status !== "NORMAL",
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-[1.5rem] font-semibold tracking-[-0.015em]">{t("admin.title")}</h1>
        <p className="text-[0.875rem] text-muted-foreground">{t("admin.subtitle")}</p>
      </header>

      <div className={cards.length > 4 ? "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5" : "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"}>
        {cards.map((card) => {
          const Icon = card.icon;
          const body = (
            <Card
              className={
                card.accent
                  ? "h-full border-warning/40 transition-colors hover:border-warning/60"
                  : "h-full transition-[border-color] hover:border-primary/30"
              }
            >
              <CardContent className="flex items-start gap-4 p-5">
                <span
                  className={
                    card.accent
                      ? "flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning/12 text-warning"
                      : "flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground"
                  }
                >
                  <Icon className="size-[18px]" />
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[0.8125rem] font-medium text-muted-foreground">{card.label}</span>
                  <span className="text-[1.625rem] font-semibold leading-none tracking-tight tabular-nums">
                    {card.value}
                  </span>
                  {"hint" in card && card.hint ? (
                    <span className="mt-1 truncate text-[0.75rem] text-muted-foreground/80">{card.hint}</span>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );

          return card.href ? (
            <Link key={card.label} href={card.href} className="block rounded-xl">
              {body}
            </Link>
          ) : (
            <div key={card.label}>{body}</div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent reports */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t("admin.moderation.title")}</CardTitle>
            <Link href="/admin/moderation" className="text-[0.8125rem] font-medium text-primary hover:underline">
              {t("notifications.view_all")}
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {data.reports.recent.length === 0 ? (
              <p className="flex items-center gap-2 py-6 text-[0.8438rem] text-muted-foreground">
                <CheckCircle2 className="size-4 text-success" />
                {t("admin.moderation.empty.body")}
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border/60">
                {data.reports.recent.map((report) => (
                  <li key={report.id} className="flex items-center gap-3 py-2.5">
                    <AlertTriangle className="size-4 shrink-0 text-warning" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[0.8438rem] font-medium">{report.reason}</span>
                      <span className="text-[0.75rem] text-muted-foreground">
                        {report.targetType} · {report.reporterName ?? "-"} ·{" "}
                        {fmt.relative(report.createdAt)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Signups + system */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.settings.signups")}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {data.signups.length === 0 ? (
                <p className="py-2 text-[0.8438rem] text-muted-foreground">-</p>
              ) : (
                <div className="flex h-16 items-end gap-1" aria-hidden>
                  {data.signups.slice(-28).map((point) => {
                    const max = Math.max(...data.signups.map((entry) => entry.count), 1);
                    return (
                      <div
                        key={point.day}
                        title={`${point.day}: ${point.count}`}
                        className="flex-1 rounded-t bg-primary/70"
                        style={{ height: `${Math.max(8, (point.count / max) * 100)}%` }}
                      />
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="size-4 text-muted-foreground" />
                {t("admin.settings.health")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <dl className="flex flex-col gap-2 text-[0.8438rem]">
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    <Users className="size-3.5" />
                    {t("admin.stat.storage")}
                  </dt>
                  <dd className="font-medium tabular-nums">{formatBytes(data.storage.bytes)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    <Ban className="size-3.5" />
                    {t("admin.users.status.banned")}
                  </dt>
                  <dd className="font-medium tabular-nums">{data.users.banned}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">build</dt>
                  <dd>
                    <Badge variant="neutral">v{APP_VERSION}</Badge>
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
