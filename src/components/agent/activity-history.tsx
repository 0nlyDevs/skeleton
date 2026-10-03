"use client";

import { Download, History, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { TableSkeleton } from "@/components/feedback/loading-skeleton";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, toQueryString } from "@/lib/api/client";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ActivityEntryDto } from "@/modules/activity/activity.dto";
import { ACTIVITY_CATEGORIES, ACTIVITY_PERIODS } from "@/modules/activity/activity.schema";
import type { ListMeta } from "@/types";

import { ActivityList } from "./activity-list";

type Page = { data: ActivityEntryDto[]; meta: ListMeta };

/** D21 — the full history: filter by area, period and person, page through, export as CSV. */
export function ActivityHistory() {
  const t = useTranslation();
  const [category, setCategory] = useState<string>("all");
  const [period, setPeriod] = useState<(typeof ACTIVITY_PERIODS)[number]>("30d");
  const [actorInput, setActorInput] = useState("");
  const [actor, setActor] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Page | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setActor(actorInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [actorInput]);

  const filters = { category, period, actor: actor || undefined };

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setResult(await apiFetch<Page>(`/api/agent/history${toQueryString({ category, period, actor: actor || undefined, page, limit: 30 })}`));
    } catch {
      setFailed(true);
    }
  }, [category, period, actor, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const meta = result?.meta;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div className="flex max-w-3xl flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">{t("tn.history.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("tn.history.subtitle")}</p>
        </div>
        <Button asChild variant="secondary" size="sm">
          {/* A plain link: the browser downloads the file the route sends. */}
          <a href={`/api/agent/history/export${toQueryString(filters)}`} download>
            <Download aria-hidden />
            {t("tn.history.export")}
          </a>
        </Button>
      </header>

      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-panel" role="group" aria-label={t("tn.history.filters")}>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          {["all", ...ACTIVITY_CATEGORIES].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={category === value}
              onClick={() => {
                setCategory(value);
                setPage(1);
              }}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-[0.8125rem] font-medium transition-colors",
                category === value ? "bg-primary text-primary-foreground" : "border border-border bg-card hover:bg-surface-muted",
              )}
            >
              {t(`tn.history.category.${value}` as MessageKey)}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <span className="sr-only">{t("tn.history.actor_search")}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input type="search" value={actorInput} onChange={(event) => setActorInput(event.target.value)} placeholder={t("tn.history.actor_search")} className="pl-9" maxLength={80} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="shrink-0 text-muted-foreground">{t("tn.history.period")}</span>
            <select
              value={period}
              onChange={(event) => {
                setPeriod(event.target.value as (typeof ACTIVITY_PERIODS)[number]);
                setPage(1);
              }}
              className="h-10 rounded-[var(--radius-control)] border border-input bg-surface px-3 text-sm"
            >
              {ACTIVITY_PERIODS.map((value) => (
                <option key={value} value={value}>
                  {t(`tn.history.period.${value}` as MessageKey)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {failed ? (
        <ErrorState onRetry={() => void load()} />
      ) : !result ? (
        <TableSkeleton />
      ) : result.data.length === 0 ? (
        <EmptyState icon={History} title={t("tn.history.empty")} />
      ) : (
        <>
          <p className="px-1 text-[0.8125rem] text-muted-foreground" aria-live="polite">
            {t("tn.history.count", { count: meta?.total ?? result.data.length })}
          </p>
          <ActivityList entries={result.data} />
          {meta && meta.totalPages > 1 ? (
            <nav className="flex items-center justify-between gap-2" aria-label={t("tn.agent.citizens.page", { page: meta.page, total: meta.totalPages })}>
              <Button type="button" size="sm" variant="secondary" disabled={!meta.hasPreviousPage} onClick={() => setPage((value) => value - 1)}>
                {t("tn.agent.citizens.previous")}
              </Button>
              <span className="text-[0.8125rem] text-muted-foreground">{t("tn.agent.citizens.page", { page: meta.page, total: meta.totalPages })}</span>
              <Button type="button" size="sm" variant="secondary" disabled={!meta.hasNextPage} onClick={() => setPage((value) => value + 1)}>
                {t("tn.agent.citizens.next")}
              </Button>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}

/** D21 — the history of one item (a service, an announcement…), under its editor. */
export function EntityHistory({ targetType, targetId }: { readonly targetType: string; readonly targetId: string }) {
  const t = useTranslation();
  const [entries, setEntries] = useState<ActivityEntryDto[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<Page>(`/api/agent/history${toQueryString({ targetType, targetId, period: "all", limit: 20 })}`)
      .then((page) => !cancelled && setEntries(page.data))
      .catch(() => !cancelled && setEntries([]));
    return () => {
      cancelled = true;
    };
  }, [targetType, targetId]);

  if (!entries || entries.length === 0) return null;
  return (
    <section aria-labelledby={`history-${targetId}`} className="flex flex-col gap-3">
      <h2 id={`history-${targetId}`} className="px-1 font-semibold">{t("tn.history.element")}</h2>
      <ActivityList entries={entries} groupByDay={false} />
    </section>
  );
}
