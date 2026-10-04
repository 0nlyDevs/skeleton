import type { Metadata } from "next";
import { TrendingDown, TrendingUp } from "lucide-react";

import { withAgentAccess } from "@/components/agent/agent-guard";
import Link from "@/components/ui/link";
import { getServerDictionary } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import { getServiceUsage } from "@/modules/stats/service-usage";

export const metadata: Metadata = { title: "Services les plus utilisés" };

const PERIODS = [7, 30, 90] as const;

/** F98 — the most used services: first what to remember, then the ranking behind it. */
export default async function AgentUsagePage({ searchParams }: { readonly searchParams: Promise<Record<string, string | undefined>> }) {
  const asked = Number((await searchParams).days);
  const days = PERIODS.find((entry) => entry === asked) ?? 30;
  return withAgentAccess("/agent/usage", async (user) => {
    const [{ t }, usage] = await Promise.all([getServerDictionary(), getServiceUsage(user, days)]);
    const max = Math.max(1, ...usage.rows.map((row) => row.total));
    const overall = usage.previousTotal > 0 ? Math.round(((usage.total - usage.previousTotal) / usage.previousTotal) * 100) : null;
    return (
      <div className="flex flex-col gap-4">
        <header className="flex flex-col gap-1 px-1">
          <h1 className="text-xl font-semibold tracking-tight">{t("tn.usage.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("tn.usage.subtitle")}</p>
        </header>

        <nav aria-label={t("tn.usage.period")} className="flex flex-wrap gap-2">
          {PERIODS.map((entry) => (
            <Link
              key={entry}
              href={`/agent/usage?days=${entry}`}
              aria-current={entry === days ? "page" : undefined}
              className={cn("rounded-full px-4 py-2 text-sm font-medium", entry === days ? "bg-foreground text-background" : "bg-surface-muted hover:bg-accent")}
            >
              {t("tn.usage.days", { count: entry })}
            </Link>
          ))}
        </nav>

        <section aria-labelledby="usage-read" className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-panel">
          <h2 id="usage-read" className="text-lg font-semibold">{t("tn.usage.read")}</h2>
          <p className="text-sm">
            {t("tn.usage.total", { count: usage.total, days })}
            {overall !== null ? ` ${t(overall >= 0 ? "tn.usage.total_up" : "tn.usage.total_down", { change: Math.abs(overall) })}` : ""}
          </p>
          {usage.insights.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("tn.usage.no_insight")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {usage.insights.map((insight) => (
                <li key={insight.kind} className="flex items-start gap-2.5 text-sm">
                  <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-bead" />
                  <span>{t(`tn.usage.insight.${insight.kind}`, { ...insight, change: "change" in insight ? Math.abs(insight.change) : 0 })}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="usage-ranking" className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-panel">
          <h2 id="usage-ranking" className="text-lg font-semibold">{t("tn.usage.ranking")}</h2>
          <p className="text-[0.8125rem] text-muted-foreground">{t("tn.usage.how")}</p>
          <ol className="flex flex-col">
            {usage.rows.map((row, index) => (
              <li key={row.slug} className="flex flex-col gap-1.5 border-b border-border/60 py-3 last:border-b-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="w-6 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">{index + 1}</span>
                  <Link href={`/services/${row.slug}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                    {row.name}
                    {row.partner ? <span className="ml-2 text-[0.75rem] font-normal text-muted-foreground">{t("tn.usage.partner")}</span> : null}
                  </Link>
                  <span className="text-sm font-semibold tabular-nums">{t("tn.usage.uses", { count: row.total, share: row.share })}</span>
                  {row.change !== null && row.change !== 0 ? (
                    <span className={cn("inline-flex items-center gap-1 text-[0.8125rem] font-medium tabular-nums", row.change > 0 ? "text-success" : "text-error")}>
                      {row.change > 0 ? <TrendingUp className="size-4" aria-hidden /> : <TrendingDown className="size-4" aria-hidden />}
                      {t(row.change > 0 ? "tn.usage.up" : "tn.usage.down", { change: Math.abs(row.change) })}
                    </span>
                  ) : null}
                </div>
                <div aria-hidden className="ml-9 h-2 overflow-hidden rounded-full bg-surface-muted">
                  <div className="h-full rounded-full bg-foreground" style={{ width: `${Math.round((row.total / max) * 100)}%` }} />
                </div>
                <p className="ml-9 text-[0.8125rem] text-muted-foreground">
                  {t("tn.usage.detail", { requests: row.requests, appointments: row.appointments, opinions: row.opinions })}
                  {row.rating !== null ? ` · ${t("tn.usage.rating", { rating: row.rating })}` : ""}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    );
  });
}
