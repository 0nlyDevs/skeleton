"use client";

import { Filter, ScrollText, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { useFormatters } from "@/hooks/use-formatters";
import { EmptyState } from "@/components/feedback/empty-state";
import { TableSkeleton } from "@/components/feedback/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch, toQueryString } from "@/lib/api/client";
import type { ListMeta } from "@/types";
import type { AuditLogDto } from "@/modules/audit/audit.dto";

const PAGE_SIZE = 20;

const ACTION_TONES: Record<string, "primary" | "success" | "warning" | "error" | "neutral"> = {
  "user.registered": "success",
  "user.role_changed": "warning",
  "user.banned": "error",
  "user.unbanned": "success",
  "user.password_changed": "warning",
  "user.two_factor_enabled": "success",
  "user.two_factor_disabled": "warning",
  "post.created": "primary",
  "post.updated": "neutral",
  "post.deleted": "error",
  "post.restored": "success",
  "report.created": "warning",
  "report.resolved": "success",
  "report.dismissed": "neutral",
  "feature_flag.toggled": "warning",
};

/**
 * Audit log viewer.
 *
 * Server-driven pagination and filtering — the trail can grow unbounded, so the
 * client never holds more than one page. The action filter loads its options from
 * the API (distinct actions actually present) rather than a hardcoded list, so the
 * dropdown stays truthful to the data.
 */
export function AuditView() {
  const t = useTranslation();
  const fmt = useFormatters();

  const [action, setAction] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<AuditLogDto[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debounced, action]);

  useEffect(() => {
    void apiFetch<{ data: string[] }>("/api/audit/actions")
      .then((response) => setActions(response.data))
      .catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // The free-text search matches the action name server-side (`action`), so
      // both controls filter the same column: the dropdown pins one exact value,
      // the search does a substring match.
      const response = await apiFetch<{ data: AuditLogDto[]; meta: ListMeta }>(
        `/api/audit${toQueryString({
          page,
          limit: PAGE_SIZE,
          order: "desc",
          ...(action !== "all" ? { action } : debounced ? { action: debounced } : {}),
        })}`,
      );
      setRows(response.data);
      setMeta(response.meta);
    } catch {
      // Error surfaced through the empty state below.
    } finally {
      setLoading(false);
    }
  }, [page, action, debounced]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[1.5rem] font-semibold tracking-[-0.015em]">{t("admin.audit.title")}</h1>
        <p className="text-[0.875rem] text-muted-foreground">{t("admin.audit.subtitle")}</p>
      </header>

      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("common.search")}
            className="pl-9"
            aria-label={t("common.search")}
          />
        </div>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-full sm:w-56" aria-label={t("admin.audit.action")}>
            <Filter className="size-4 opacity-60" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">—</SelectItem>
            {actions.map((entry) => (
              <SelectItem key={entry} value={entry}>
                {entry}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <TableSkeleton rows={8} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title={t("admin.audit.empty.title")}
            description={t("admin.audit.empty.body")}
            className="m-4 border-0 bg-transparent"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-[0.8438rem]">
              <thead>
                <tr className="border-b border-border/70 text-[0.75rem] uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-3 font-medium">{t("admin.audit.action")}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t("admin.audit.actor")}</th>
                  <th scope="col" className="px-4 py-3 font-medium">{t("admin.audit.target")}</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">{t("admin.audit.date")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-surface-muted/50">
                    <td className="px-4 py-3">
                      <Badge variant={ACTION_TONES[row.action] ?? "neutral"} className="font-mono text-[0.7188rem]">
                        {row.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-medium">{row.actor?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-[0.7812rem] text-muted-foreground">
                      {row.targetType ? `${row.targetType} · ${row.targetId?.slice(0, 8)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-[0.7812rem] tabular-nums text-muted-foreground">
                      {fmt.dateTime(row.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <nav className="flex items-center justify-between gap-3" aria-label="Pagination">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          {t("common.previous")}
        </Button>
        <span className="text-[0.8125rem] tabular-nums text-muted-foreground">
          {t("common.page")} {page} {t("common.of")} {totalPages}
        </span>
        <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          {t("common.next")}
        </Button>
      </nav>
    </div>
  );
}
