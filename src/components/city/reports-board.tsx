"use client";

import { HandHeart, Inbox } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { TableSkeleton } from "@/components/feedback/loading-skeleton";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { useFormatters } from "@/hooks/use-formatters";
import type { MessageKey } from "@/lib/i18n";
import { CITY_ZONES, cityZoneLabelKey } from "@/modules/alerts/city-zones";
import { ISSUE_TYPES } from "@/modules/city-requests/city-requests.schema";
import type { ReportPage } from "@/modules/city-requests/city-requests.reports";

const SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius-control)] border border-input bg-surface px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

type Sort = "recent" | "supported";

/** F52/F79 — the reported problems of Terra Nova, filterable and sortable. */
export function ReportsBoard({
  initialStatus = "OPEN",
  initialSort = "supported",
}: {
  readonly initialStatus?: string;
  readonly initialSort?: string;
}) {
  const t = useTranslation();
  const fmt = useFormatters();
  const [issueType, setIssueType] = useState("");
  const [zone, setZone] = useState("");
  const [status, setStatus] = useState(initialStatus === "DONE" ? "DONE" : "OPEN");
  const [sort, setSort] = useState<Sort>(initialSort === "recent" ? "recent" : "supported");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<ReportPage | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    const params = new URLSearchParams({ status, sort, page: String(page), limit: "20" });
    if (issueType) params.set("issueType", issueType);
    if (zone) params.set("zone", zone);
    try {
      setResult(await apiFetch<ReportPage>(`/api/city-reports?${params.toString()}`));
    } catch {
      setFailed(true);
    }
  }, [status, sort, issueType, zone, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleSupport = async (reference: string, supported: boolean) => {
    setBusy(reference);
    try {
      const response = await apiFetch<{ data: { supportCount: number; supportedAt: string | null } }>(
        `/api/city-requests/${reference}/support`,
        { method: supported ? "DELETE" : "POST" },
      );
      setResult((current) =>
        current
          ? {
              ...current,
              data: current.data.map((report) =>
                report.reference === reference
                  ? { ...report, supportCount: response.data.supportCount, supportedAt: response.data.supportedAt }
                  : report,
              ),
            }
          : current,
      );
      toast.success(supported ? t("tn.reports.no_longer_supported") : t("tn.reports.support_thanks"));
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1 px-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("tn.reports.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("tn.reports.subtitle")}</p>
      </header>

      <div className="grid gap-2 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-[0.8125rem]">
          <span className="text-muted-foreground">{t("tn.reports.filter.issue")}</span>
          <select value={issueType} onChange={(event) => { setIssueType(event.target.value); setPage(1); }} className={SELECT_CLASS}>
            <option value="">{t("tn.reports.filter.all")}</option>
            {ISSUE_TYPES.map((value) => (
              <option key={value} value={value}>{t(`tn.issue.${value}` as MessageKey)}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[0.8125rem]">
          <span className="text-muted-foreground">{t("tn.reports.filter.zone")}</span>
          <select value={zone} onChange={(event) => { setZone(event.target.value); setPage(1); }} className={SELECT_CLASS}>
            <option value="">{t("tn.reports.filter.all")}</option>
            {CITY_ZONES.map((item) => (
              <option key={item.id} value={item.id}>{t(cityZoneLabelKey(item.id))}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[0.8125rem]">
          <span className="text-muted-foreground">{t("tn.reports.filter.state")}</span>
          <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className={SELECT_CLASS}>
            <option value="OPEN">{t("tn.reports.state.open")}</option>
            <option value="DONE">{t("tn.reports.state.done")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[0.8125rem]">
          <span className="text-muted-foreground">{t("tn.reports.sort")}</span>
          <select value={sort} onChange={(event) => { setSort(event.target.value as Sort); setPage(1); }} className={SELECT_CLASS}>
            <option value="supported">{t("tn.reports.sort.supported")}</option>
            <option value="recent">{t("tn.reports.sort.recent")}</option>
          </select>
        </label>
      </div>

      {failed ? (
        <ErrorState onRetry={() => void load()} />
      ) : !result ? (
        <TableSkeleton />
      ) : result.data.length === 0 ? (
        <EmptyState icon={Inbox} title={t("tn.reports.empty_title")} description={t("tn.reports.empty_body")} />
      ) : (
        <ul className="flex flex-col gap-3">
          {result.data.map((report) => {
            const supported = report.supportedAt !== null;
            return (
              <li key={report.reference} className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-panel">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="neutral">{t(`tn.issue.${report.issueType}` as MessageKey)}</Badge>
                  {report.zone ? <Badge variant="outline">{t(cityZoneLabelKey(report.zone as never))}</Badge> : null}
                  <Badge variant={report.status === "RESOLVED" || report.status === "CLOSED" ? "success" : "warning"}>
                    {t(`tn.status.${report.status}` as MessageKey)}
                  </Badge>
                  <span className="ml-auto text-[0.75rem] text-muted-foreground">{report.reference}</span>
                </div>
                <p className="text-[0.9375rem] font-medium">{report.subject}</p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[0.8125rem] text-muted-foreground">
                    {t("tn.reports.count", { count: report.supportCount })}
                    {" · "}
                    {fmt.relative(report.createdAt)}
                  </span>
                  <div className="flex flex-col items-end gap-1">
                    <Button
                      size="sm"
                      variant={supported ? "secondary" : "primary"}
                      disabled={busy === report.reference}
                      onClick={() => void toggleSupport(report.reference, supported)}
                    >
                      <HandHeart aria-hidden />
                      {supported ? t("tn.reports.withdraw") : t("tn.reports.support")}
                    </Button>
                    {supported && report.supportedAt ? (
                      <span className="text-[0.75rem] text-muted-foreground">{t("tn.reports.since", { date: fmt.date(report.supportedAt) })}</span>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {result && result.pageCount > 1 ? (
        <nav className="flex items-center justify-between gap-2" aria-label={t("common.page")}>
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("common.previous")}</Button>
          <span className="text-sm text-muted-foreground">{t("tn.page_of", { page: result.page, count: result.pageCount })}</span>
          <Button size="sm" variant="secondary" disabled={page >= result.pageCount} onClick={() => setPage(page + 1)}>{t("common.next")}</Button>
        </nav>
      ) : null}
    </div>
  );
}
