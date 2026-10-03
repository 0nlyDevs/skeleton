"use client";

import { Inbox, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { RequestList } from "@/components/city/request-list";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { TableSkeleton } from "@/components/feedback/loading-skeleton";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { CityRequestSummaryDto } from "@/modules/city-requests/city-requests.dto";

const STATUS_TABS = ["OPEN", "NEW", "IN_PROGRESS", "WAITING_CITIZEN", "RESOLVED", "CLOSED", "ALL"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

interface Page {
  readonly data: CityRequestSummaryDto[];
  readonly total: number;
  readonly page: number;
  readonly pageCount: number;
  readonly counts?: Record<string, number>;
}

/** F22 — every resident request, its status, and which ones still need action. */
export function AgentInbox({ initialStatus }: { readonly initialStatus: string }) {
  const t = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<StatusTab>(
    (STATUS_TABS as readonly string[]).includes(initialStatus) ? (initialStatus as StatusTab) : "OPEN",
  );
  const [scope, setScope] = useState<"all" | "assigned">("all");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Page | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);

  const load = useCallback(async () => {
    setFailed(false);
    const params = new URLSearchParams({ scope, page: String(page), limit: "20" });
    if (status !== "ALL") params.set("status", status);
    if (query) params.set("q", query);
    try {
      setResult(await apiFetch<Page>(`/api/city-requests?${params.toString()}`));
    } catch {
      setFailed(true);
    }
  }, [scope, status, query, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const pickStatus = (next: StatusTab) => {
    setStatus(next);
    setPage(1);
    router.replace(`${pathname}?status=${next}`, { scroll: false });
  };

  const counts = result?.counts ?? {};
  const countFor = (tab: StatusTab): number | null => {
    if (tab === "ALL") return Object.values(counts).reduce((sum, value) => sum + value, 0);
    if (tab === "OPEN") return (counts.NEW ?? 0) + (counts.IN_PROGRESS ?? 0) + (counts.WAITING_CITIZEN ?? 0);
    return counts[tab] ?? 0;
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1 px-1">
        <h1 className="text-xl font-semibold tracking-tight">{t("tn.agent.inbox.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("tn.agent.inbox.subtitle")}</p>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setPage(1);
            }}
            placeholder={t("tn.agent.inbox.search")}
            aria-label={t("tn.agent.inbox.search")}
            className="pl-9"
            maxLength={80}
          />
        </div>
        <div className="flex gap-1 rounded-full border border-border bg-card p-1" role="group">
          {(["all", "assigned"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={scope === value}
              onClick={() => {
                setScope(value);
                setPage(1);
              }}
              className={cn(
                "rounded-full px-3 py-1 text-[0.8125rem] font-medium",
                scope === value ? "bg-primary text-primary-foreground" : "hover:bg-surface-muted",
              )}
            >
              {value === "all" ? t("tn.agent.inbox.scope_all") : t("tn.agent.inbox.scope_assigned")}
            </button>
          ))}
        </div>
      </div>

      <nav aria-label={t("tn.agent.req.status")} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            aria-pressed={status === tab}
            onClick={() => pickStatus(tab)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.8125rem] font-medium",
              status === tab ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-surface-muted",
            )}
          >
            {t(`tn.status.${tab}` as MessageKey)}
            {result?.counts ? <span className="tabular-nums opacity-75">{countFor(tab)}</span> : null}
          </button>
        ))}
      </nav>

      {failed ? (
        <ErrorState onRetry={() => void load()} />
      ) : !result ? (
        <TableSkeleton />
      ) : result.data.length === 0 ? (
        <EmptyState icon={Inbox} title={t("tn.agent.inbox.empty_title")} description={t("tn.agent.inbox.empty_body")} />
      ) : (
        <RequestList requests={result.data} hrefBase="/agent/requests" agentView />
      )}

      {result && result.pageCount > 1 ? (
        <nav className="flex items-center justify-between gap-2" aria-label={t("common.page")}>
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {t("common.previous")}
          </Button>
          <span className="text-sm text-muted-foreground">{t("tn.page_of", { page: result.page, count: result.pageCount })}</span>
          <Button size="sm" variant="secondary" disabled={page >= result.pageCount} onClick={() => setPage(page + 1)}>
            {t("common.next")}
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
