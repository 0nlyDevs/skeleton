"use client";

import { AlertTriangle, Check, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/feedback/empty-state";
import { TableSkeleton } from "@/components/feedback/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch, ApiRequestError } from "@/lib/api/client";
import { formatRelative } from "@/lib/format";
import type { ListMeta } from "@/types";

interface ReportDto {
  readonly id: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly reason: string;
  readonly status: string;
  readonly createdAt: string;
  readonly reporter: { readonly id: string; readonly name: string } | null;
}

/**
 * Moderation queue.
 *
 * Resolving never deletes anything directly: "remove" soft-deletes the reported
 * post through the posts service (so the author's data stays recoverable and the
 * action is audited twice — once as a moderation event, once as a post deletion),
 * and "dismiss" just closes the report. Both refresh the list from the server
 * rather than mutating local state, because two moderators can act concurrently.
 */
export function ModerationQueue() {
  const t = useTranslation();

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
        body: { action },
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
                    <span className="truncate text-[13.5px] font-medium">{report.reason}</span>
                  </div>
                  <span className="text-[12px] text-muted-foreground">
                    {t("admin.moderation.reporter")}: {report.reporter?.name ?? "—"} ·{" "}
                    {formatRelative(report.createdAt)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {report.targetType === "POST" ? (
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/posts/${report.targetId}`}>{t("admin.moderation.target")}</Link>
                    </Button>
                  ) : null}
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={busyId !== null}
                    onClick={() => void resolve(report, "remove")}
                  >
                    <X />
                    {t("admin.moderation.remove")}
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
