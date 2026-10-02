"use client";

import { AlertTriangle, Check, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { useFormatters } from "@/hooks/use-formatters";
import { EmptyState } from "@/components/feedback/empty-state";
import { TableSkeleton } from "@/components/feedback/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch, ApiRequestError } from "@/lib/api/client";
import type { ListMeta } from "@/types";

interface ReportDto {
  readonly id: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly targetLabel: string | null;
  readonly targetSummary: string | null;
  readonly targetHref: string | null;
  readonly reason: string;
  readonly status: string;
  readonly createdAt: string;
  readonly reporter: { readonly id: string; readonly name: string } | null;
}

/**
 * Moderation queue.
 *
 * "Remove" applies the matching moderation action to the reported target and
 * "dismiss" closes the claim. Both refresh from the server so the queue reflects
 * the persisted resolution and its audit trail.
 */
export function ModerationQueue() {
  const t = useTranslation();
  const fmt = useFormatters();

  const [reports, setReports] = useState<ReportDto[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch<{ data: ReportDto[]; meta: ListMeta }>(
        "/api/reports?status=OPEN&limit=20",
      );
      setReports(response.data);
      setMeta(response.meta);
    } catch {
      // The error state renders from the empty catch below.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (report: ReportDto, action: "remove" | "dismiss") => {
    setBusyId(report.id);
    try {
      await apiFetch(`/api/reports/${report.id}`, {
        method: "PATCH",
        body: { resolution: action },
      });
      toast.success(action === "remove" ? t("admin.moderation.resolved") : t("admin.moderation.dismissed"));
      await load();
    } catch (caught) {
      toast.error(
        caught instanceof ApiRequestError ? t(`error.${caught.code}` as never) : t("feedback.error.body"),
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[24px] font-semibold tracking-[-0.015em]">{t("admin.moderation.title")}</h1>
        <p className="text-[14px] text-muted-foreground">{t("admin.moderation.subtitle")}</p>
      </header>

      <Card className="overflow-hidden">
        {loading ? (
          <TableSkeleton rows={4} />
        ) : reports.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={t("admin.moderation.empty.title")}
            description={t("admin.moderation.empty.body")}
            className="m-4 border-0 bg-transparent"
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {reports.map((report) => (
              <li key={report.id} className="flex flex-wrap items-center gap-3 px-4 py-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/12 text-warning">
                  <AlertTriangle className="size-4" />
                </span>

                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="warning">{report.targetType}</Badge>
                    <span className="truncate text-[13.5px] font-medium">{report.targetLabel ?? report.targetId}</span>
                  </div>
                  {report.targetSummary ? <p className="line-clamp-2 text-[12px] text-foreground/80">{report.targetSummary}</p> : null}
                  <p className="text-[12px] text-muted-foreground">{t("admin.moderation.reason")}: {report.reason}</p>
                  <span className="text-[12px] text-muted-foreground">
                    {t("admin.moderation.reporter")}: {report.reporter?.name ?? "—"} ·{" "}
                    {fmt.relative(report.createdAt)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {report.targetHref ? (
                    <Button asChild variant="ghost" size="sm">
                      <Link href={report.targetHref}>{t("admin.moderation.target")}</Link>
                    </Button>
                  ) : null}
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={busyId !== null}
                    onClick={() => void resolve(report, "remove")}
                  >
                    <X />
                    {report.targetType === "user" ? t("admin.moderation.suspend") : t("admin.moderation.remove")}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busyId !== null}
                    onClick={() => void resolve(report, "dismiss")}
                  >
                    <Check />
                    {t("admin.moderation.dismiss")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {meta && meta.totalPages > 1 ? (
        <p className="text-center text-[13px] text-muted-foreground">
          {meta.total} {t("common.results")}
        </p>
      ) : null}
    </div>
  );
}
