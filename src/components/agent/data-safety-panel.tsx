"use client";

import { DatabaseBackup, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { formatDateTime } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { BackupFileDto, BackupReportDto } from "@/modules/backups/backups.service";
import type { IntegrityReportDto } from "@/modules/integrity/integrity.service";

import { LoadPanel } from "./load-panel";

function size(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} ko` : `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

/** One line of a report: a filled or empty bubble, and the sentence. */
function Line({ ok, children }: { readonly ok: boolean; readonly children: React.ReactNode }) {
  return (
    <li className={cn("flex items-start gap-2.5 py-2 text-sm", ok ? "" : "font-medium text-error")}>
      <span aria-hidden className={cn("state-bubble mt-1", ok ? "text-success" : "text-error")} data-fill={ok ? "full" : "ring"} />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

/**
 * F85 + F87 — two questions an administrator must be able to answer at any
 * time, in plain sentences: "is our data coherent?" and "can it be saved?".
 */
export function DataSafetyPanel() {
  const { t, locale } = useI18n();
  const [report, setReport] = useState<IntegrityReportDto | null>(null);
  const [files, setFiles] = useState<BackupFileDto[] | null>(null);
  const [backup, setBackup] = useState<BackupReportDto | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      setReport((await apiFetch<{ data: IntegrityReportDto }>("/api/integrity")).data);
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setChecking(false);
    }
  }, [t]);

  const loadFiles = useCallback(async () => {
    try {
      setFiles((await apiFetch<{ data: BackupFileDto[] }>("/api/backups")).data);
    } catch {
      setFiles([]);
    }
  }, []);

  useEffect(() => {
    void check();
    void loadFiles();
  }, [check, loadFiles]);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await apiFetch<{ data: BackupReportDto }>("/api/backups", { method: "POST" });
      setBackup(data);
      toast[data.ok ? "success" : "error"](t(data.ok ? "tn.backup.done" : "tn.backup.failed"));
      await loadFiles();
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <LoadPanel />
      <section aria-labelledby="integrity-title" className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="integrity-title" className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="size-4" aria-hidden />
              {t("tn.integrity.title")}
            </h2>
            <p className="text-[0.8125rem] text-muted-foreground">{t("tn.integrity.subtitle")}</p>
          </div>
          <Button type="button" size="sm" variant="secondary" disabled={checking} onClick={() => void check()}>
            {checking ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
            {t("tn.integrity.again")}
          </Button>
        </div>
        {report === null ? (
          <Skeleton className="h-40 rounded-2xl" />
        ) : (
          <>
            <p role="status" className={cn("rounded-xl px-3 py-2 text-sm font-semibold", report.ok ? "bg-success/10 text-success" : "bg-error/10 text-error")}>
              {report.ok ? t("tn.integrity.all_ok") : t("tn.integrity.some_wrong", { count: report.checks.filter((item) => !item.ok).length })}
              <span className="block text-[0.75rem] font-normal text-muted-foreground">{t("tn.integrity.checked_at", { date: formatDateTime(report.checkedAt, locale) })}</span>
            </p>
            <ul className="flex flex-col divide-y divide-border/60">
              {report.checks.map((item) => (
                <Line key={item.id} ok={item.ok}>
                  {t(`tn.integrity.check.${item.id}` as MessageKey)}
                  {item.ok ? "" : `, ${t("tn.integrity.found", { count: item.count })}`}
                </Line>
              ))}
            </ul>
            <h3 className="pt-1 text-[0.8125rem] font-semibold text-muted-foreground">{t("tn.integrity.signals")}</h3>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {(
                [
                  ["failed", report.signals.failedSignIns24h],
                  ["locked", report.signals.lockedSignIns24h],
                  ["bots", report.signals.blockedForms24h],
                  ["roles", report.signals.roleChanges24h],
                ] as const
              ).map(([key, value]) => (
                <div key={key} className="rounded-xl bg-surface-muted px-3 py-2">
                  <dd className="text-lg font-semibold tabular-nums">{value}</dd>
                  <dt className="text-[0.75rem] text-muted-foreground">{t(`tn.integrity.signal.${key}` as MessageKey)}</dt>
                </div>
              ))}
            </dl>
          </>
        )}
      </section>

      <section aria-labelledby="backup-title" className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-5 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="backup-title" className="flex items-center gap-2 font-semibold">
              <DatabaseBackup className="size-4" aria-hidden />
              {t("tn.backup.title")}
            </h2>
            <p className="text-[0.8125rem] text-muted-foreground">{t("tn.backup.subtitle")}</p>
          </div>
          <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {t("tn.backup.run")}
          </Button>
        </div>
        {backup ? (
          <div role="status" className="flex flex-col gap-2">
            <p className={cn("rounded-xl px-3 py-2 text-sm font-semibold", backup.ok ? "bg-success/10 text-success" : "bg-error/10 text-error")}>
              {backup.ok ? t("tn.backup.ok", { rows: backup.tables.reduce((sum, item) => sum + item.saved, 0), size: size(backup.sizeBytes), seconds: (backup.durationMs / 1000).toFixed(1) }) : t("tn.backup.failed")}
            </p>
            <ul className="flex flex-col divide-y divide-border/60">
              {backup.tables.map((item) => (
                <Line key={item.table} ok={item.ok}>
                  {t(`tn.backup.table.${item.table}` as MessageKey)}, {t("tn.backup.rows", { count: item.saved })}
                </Line>
              ))}
            </ul>
            <p className="break-all font-mono text-[0.6875rem] text-muted-foreground">{t("tn.backup.checksum")} {backup.checksum}</p>
          </div>
        ) : null}
        <h3 className="pt-1 text-[0.8125rem] font-semibold text-muted-foreground">{t("tn.backup.files")}</h3>
        {files === null ? (
          <Skeleton className="h-16 rounded-2xl" />
        ) : files.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">{t("tn.backup.none")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border/60">
            {files.map((file) => (
              <Line key={file.file} ok={file.intact}>
                {formatDateTime(file.createdAt, locale)} · {size(file.sizeBytes)} · {t(file.intact ? "tn.backup.intact" : "tn.backup.damaged")}
              </Line>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
