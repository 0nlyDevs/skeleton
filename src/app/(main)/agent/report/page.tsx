import type { Metadata } from "next";
import { FileDown } from "lucide-react";

import { withAgentAccess } from "@/components/agent/agent-guard";
import { PrintButton } from "@/components/city/print-button";
import Link from "@/components/ui/link";
import { formatDate } from "@/lib/format";
import { getServerDictionary } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import { getActivityReport } from "@/modules/stats/activity-report";

export const metadata: Metadata = { title: "Rapport d'activité" };

const PERIODS = [7, 30, 90] as const;

/** F103 — the activity report: what to act on first, then the figures, on one printable page. */
export default async function AgentReportPage({ searchParams }: { readonly searchParams: Promise<Record<string, string | undefined>> }) {
  const asked = Number((await searchParams).days);
  const days = PERIODS.find((entry) => entry === asked) ?? 30;
  return withAgentAccess("/agent/report", async (user) => {
    const [{ t, locale }, report] = await Promise.all([getServerDictionary(), getActivityReport(user, days)]);
    const change = report.requests.previous > 0 ? Math.round(((report.requests.received - report.requests.previous) / report.requests.previous) * 100) : null;
    const figures = [
      { label: t("tn.report.fig.received"), value: report.requests.received },
      { label: t("tn.report.fig.closed"), value: report.requests.closed },
      { label: t("tn.report.fig.open"), value: report.requests.openNow },
      { label: t("tn.report.fig.delay"), value: report.requests.hoursToClose === null ? "-" : t("tn.report.hours", { count: report.requests.hoursToClose }) },
      { label: t("tn.report.fig.appointments"), value: report.appointments.booked + report.appointments.asked },
      { label: t("tn.report.fig.rating"), value: report.opinions.average === null ? "-" : `${report.opinions.average}/5` },
      { label: t("tn.report.fig.alerts"), value: report.city.alerts },
      { label: t("tn.report.fig.accounts"), value: report.city.newAccounts },
    ];
    return (
      <div className="flex flex-col gap-4">
        <header className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight">{t("tn.report.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("tn.report.subtitle")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PrintButton label={t("tn.report.print")} />
            <a href={`/api/stats/activity-report?days=${days}&download=1`} className="inline-flex h-10 items-center gap-2 rounded-full bg-surface-muted px-4 text-sm font-semibold hover:bg-accent">
              <FileDown className="size-4" aria-hidden />
              {t("tn.report.download")}
            </a>
          </div>
        </header>

        <nav aria-label={t("tn.usage.period")} className="flex flex-wrap gap-2">
          {PERIODS.map((entry) => (
            <Link key={entry} href={`/agent/report?days=${entry}`} aria-current={entry === days ? "page" : undefined} className={cn("rounded-full px-4 py-2 text-sm font-medium", entry === days ? "bg-foreground text-background" : "bg-surface-muted hover:bg-accent")}>
              {t("tn.usage.days", { count: entry })}
            </Link>
          ))}
        </nav>

        <article className="print-document flex flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-panel">
            <p className="text-[0.8125rem] text-muted-foreground">{t("tn.report.period", { from: formatDate(report.from, { locale }), to: formatDate(report.to, { locale }) })}</p>
            <h2 className="text-lg font-semibold">{t("tn.report.summary")}</h2>
            <p className="text-sm leading-relaxed">
              {t("tn.report.sentence.requests", { received: report.requests.received, closed: report.requests.closed, open: report.requests.openNow })}{" "}
              {change !== null ? t(change >= 0 ? "tn.report.sentence.up" : "tn.report.sentence.down", { change: Math.abs(change) }) : ""}{" "}
              {report.requests.hoursToClose !== null ? t("tn.report.sentence.delay", { count: report.requests.hoursToClose }) : ""}{" "}
              {report.opinions.count > 0 && report.opinions.average !== null ? t("tn.report.sentence.opinions", { count: report.opinions.count, average: report.opinions.average }) : t("tn.report.sentence.no_opinion")}
            </p>
          </section>

          <section className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-panel">
            <h2 className="text-lg font-semibold">{t("tn.report.attention")}</h2>
            {report.attention.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("tn.report.attention_none")}</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {report.attention.map((item, index) => (
                  <li key={item.kind} className="flex items-start gap-2.5 text-sm">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-[0.75rem] font-bold text-primary-foreground">{index + 1}</span>
                    <span>{t(`tn.report.attention.${item.kind}`, { value: item.value })}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-panel">
            <h2 className="text-lg font-semibold">{t("tn.report.figures")}</h2>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {figures.map((figure) => (
                <div key={figure.label} className="rounded-2xl bg-surface-muted p-3">
                  <dd className="text-xl font-semibold tabular-nums">{figure.value}</dd>
                  <dt className="text-[0.8125rem] text-muted-foreground">{figure.label}</dt>
                </div>
              ))}
            </dl>
          </section>

          <section className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-panel">
            <h2 className="text-lg font-semibold">{t("tn.report.services")}</h2>
            {report.topServices.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("tn.usage.no_insight")}</p>
            ) : (
              <ol className="flex flex-col">
                {report.topServices.map((service, index) => (
                  <li key={service.name} className="flex items-baseline gap-3 border-b border-border/60 py-2 text-sm last:border-b-0">
                    <span className="w-5 shrink-0 font-semibold tabular-nums text-muted-foreground">{index + 1}</span>
                    <span className="min-w-0 flex-1 font-medium">{service.name}</span>
                    <span className="tabular-nums">{t("tn.usage.uses", { count: service.total, share: service.share })}</span>
                  </li>
                ))}
              </ol>
            )}
            <p className="text-[0.8125rem] text-muted-foreground">{t("tn.report.security", { failed: report.security.failedSignIns, locked: report.security.lockedSignIns })}</p>
          </section>
        </article>
      </div>
    );
  });
}
