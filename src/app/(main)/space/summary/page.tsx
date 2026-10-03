import { CalendarClock, CheckCircle2, Download, FolderOpen, Hourglass } from "lucide-react";
import type { Metadata } from "next";

import { PrintButton } from "@/components/city/print-button";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { requirePageAuth } from "@/lib/auth/page-guards";
import { formatDateTime, formatLongDate } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { getServerDictionary } from "@/lib/i18n/server";
import { buildRequestSummary, type SummaryFilter } from "@/modules/city-requests/city-requests.summary";

export const metadata: Metadata = { title: "Récapitulatif de mes demandes" };

/**
 * F56 — the resident's summary of their requests: totals, then each request
 * with where it stands, the last answer from the city and how long it took.
 * Prints cleanly (or saves as PDF from the print dialog) and exports as CSV.
 */
export default async function RequestSummaryPage({ searchParams }: { readonly searchParams: Promise<{ filter?: string }> }) {
  const { user } = await requirePageAuth("/space/summary");
  const { t, locale } = await getServerDictionary();
  const raw = (await searchParams).filter;
  const filter: SummaryFilter = raw === "open" || raw === "done" ? raw : "all";
  const summary = await buildRequestSummary(user, filter);
  const totals = [
    { icon: FolderOpen, label: t("tn.summary.total"), value: summary.totals.all },
    { icon: Hourglass, label: t("tn.summary.open"), value: summary.totals.open },
    { icon: CalendarClock, label: t("tn.summary.waiting"), value: summary.totals.waitingForYou },
    { icon: CheckCircle2, label: t("tn.summary.done"), value: summary.totals.done },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-5">
      <div className="print:hidden">
        <Breadcrumbs
          label={t("tn.breadcrumb.label")}
          items={[{ label: t("tn.nav.home"), href: "/" }, { label: t("tn.nav.my_space"), href: "/space" }, { label: t("tn.summary.title") }]}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <nav aria-label={t("tn.space.history.label")} className="flex gap-1.5">
          {(["all", "open", "done"] as const).map((value) => (
            <Link
              key={value}
              href={value === "all" ? "/space/summary" : `/space/summary?filter=${value}`}
              aria-current={filter === value ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 text-[0.8125rem] font-medium ${filter === value ? "bg-primary text-primary-foreground" : "border border-border bg-card hover:bg-surface-muted"}`}
            >
              {t(`tn.summary.filter.${value}` as MessageKey)}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap gap-2">
          <PrintButton label={t("tn.summary.print")} />
          <Button asChild variant="secondary">
            <a href={`/api/city-requests/summary?filter=${filter}`} download>
              <Download aria-hidden />
              {t("tn.summary.csv")}
            </a>
          </Button>
        </div>
      </div>

      <article className="print-document flex flex-col gap-5">
        <header className="flex flex-col gap-1 px-1">
          <p className="text-[0.8125rem] font-medium text-primary">Terra Nova</p>
          <h1 className="text-2xl font-semibold tracking-tight">{t("tn.summary.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("tn.summary.for", { name: summary.resident.name, date: formatDateTime(summary.generatedAt, locale) })}
            {filter !== "all" ? ` · ${t(`tn.summary.filter.${filter}` as MessageKey)}` : ""}
          </p>
        </header>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {totals.map((item) => (
            <div key={item.label} className="flex flex-col gap-1 rounded-2xl border border-border/70 bg-card p-4">
              <item.icon className="size-4 text-muted-foreground" aria-hidden />
              <dd className="text-2xl font-semibold tabular-nums">{item.value}</dd>
              <dt className="text-[0.8125rem] text-muted-foreground">{item.label}</dt>
            </div>
          ))}
        </dl>
        {summary.totals.averageDays !== null ? (
          <p className="px-1 text-sm">{t("tn.summary.average", { days: summary.totals.averageDays })}</p>
        ) : null}

        {summary.rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{t("tn.summary.empty")}</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {summary.rows.map((row) => (
              <li key={row.reference} className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-card p-4 print:break-inside-avoid">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[0.8125rem] text-muted-foreground">{row.reference}</span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[0.75rem] font-medium">{t(`tn.status.${row.status}` as MessageKey)}</span>
                  {row.waitingForYou ? <span className="text-[0.8125rem] font-semibold text-warning">{t("tn.summary.your_turn")}</span> : null}
                </div>
                <h2 className="font-semibold">
                  <Link href={`/space/requests/${row.reference}`} className="hover:underline">
                    {row.subject}
                  </Link>
                </h2>
                <p className="text-[0.8125rem] text-muted-foreground">
                  {row.service ?? t("tn.no_service")} · {t("tn.summary.sent", { date: formatLongDate(row.createdAt, locale) })} ·{" "}
                  {row.handledInDays !== null
                    ? t("tn.summary.handled", { days: row.handledInDays })
                    : t("tn.summary.updated", { date: formatLongDate(row.updatedAt, locale) })}
                </p>
                {row.lastReply ? (
                  <blockquote className="rounded-xl bg-surface-muted px-3 py-2 text-sm">
                    <span className="block text-[0.75rem] font-medium text-muted-foreground">
                      {t("tn.summary.last_reply", { date: formatLongDate(row.lastReply.at, locale) })}
                    </span>
                    {row.lastReply.body}
                  </blockquote>
                ) : (
                  <p className="text-[0.8125rem] text-muted-foreground">{t("tn.summary.no_reply")}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </article>
    </div>
  );
}
