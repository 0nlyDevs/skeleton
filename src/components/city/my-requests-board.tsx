"use client";

import { Inbox } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { TableSkeleton } from "@/components/feedback/loading-skeleton";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "@/components/ui/link";
import { apiFetch } from "@/lib/api/client";
import { CITY_ZONES, cityZoneLabelKey } from "@/modules/alerts/city-zones";
import type { CityRequestSummaryDto } from "@/modules/city-requests/city-requests.dto";

import { RequestList } from "./request-list";

const SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius-control)] border border-input bg-surface px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

interface Page {
  readonly data: CityRequestSummaryDto[];
  readonly total: number;
  readonly page: number;
  readonly pageCount: number;
}

/** F79 — the resident's own requests, filtered by subject, district and state. */
export function MyRequestsBoard() {
  const t = useTranslation();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [zone, setZone] = useState("");
  const [status, setStatus] = useState("ALL");
  const [sort, setSort] = useState<"recent" | "supported">("recent");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Page | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);

  const load = useCallback(async () => {
    setFailed(false);
    const params = new URLSearchParams({ scope: "mine", sort, page: String(page), limit: "20" });
    if (query) params.set("q", query);
    if (zone) params.set("zone", zone);
    if (status !== "ALL") params.set("status", status);
    try {
      setResult(await apiFetch<Page>(`/api/city-requests?${params.toString()}`));
    } catch {
      setFailed(true);
    }
  }, [query, zone, status, sort, page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1 px-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("tn.myrequests.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("tn.myrequests.subtitle")}</p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            setPage(1);
          }}
          placeholder={t("tn.myrequests.search")}
          aria-label={t("tn.myrequests.search")}
          maxLength={80}
          className="min-w-0 flex-1"
        />
        <Link href="/reports" className="text-sm font-medium text-primary hover:underline">
          {t("tn.reports.title")}
        </Link>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
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
            <option value="ALL">{t("tn.reports.filter.all")}</option>
            <option value="OPEN">{t("tn.reports.state.open")}</option>
            <option value="DONE">{t("tn.reports.state.done")}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[0.8125rem]">
          <span className="text-muted-foreground">{t("tn.reports.sort")}</span>
          <select value={sort} onChange={(event) => { setSort(event.target.value as "recent" | "supported"); setPage(1); }} className={SELECT_CLASS}>
            <option value="recent">{t("tn.reports.sort.recent")}</option>
            <option value="supported">{t("tn.reports.sort.supported")}</option>
          </select>
        </label>
      </div>

      {failed ? (
        <ErrorState onRetry={() => void load()} />
      ) : !result ? (
        <TableSkeleton />
      ) : result.data.length === 0 ? (
        <EmptyState icon={Inbox} title={t("tn.myrequests.empty_title")} description={t("tn.myrequests.empty_body")} />
      ) : (
        <RequestList requests={result.data} hrefBase="/space/requests" />
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
