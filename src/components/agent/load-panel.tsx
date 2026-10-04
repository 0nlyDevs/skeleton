"use client";

import { Gauge } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { LoadSnapshot } from "@/lib/load/monitor";

/**
 * F77/F78 — the platform's load, live: how many requests are being served,
 * how fast, and whether essential mode is on. Administrators can force the
 * mode before a known peak.
 */
export function LoadPanel() {
  const t = useTranslation();
  const [snapshot, setSnapshot] = useState<LoadSnapshot | null>(null);

  const load = useCallback(async () => {
    try {
      setSnapshot((await apiFetch<{ data: LoadSnapshot }>("/api/load")).data);
    } catch {
      // Keep the last figures on screen.
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const force = async (forced: boolean) => {
    try {
      setSnapshot((await apiFetch<{ data: LoadSnapshot }>("/api/load", { method: "PUT", body: { forced } })).data);
      toast.success(t(forced ? "tn.load.forced_on" : "tn.load.forced_off"));
    } catch (error) {
      toast.error(describeApiError(error, t));
    }
  };

  const figures = snapshot
    ? ([
        ["in_flight", snapshot.inFlight],
        ["latency", `${snapshot.latencyMs} ms`],
        ["lag", `${snapshot.eventLoopLagMs} ms`],
        ["served", snapshot.served],
        ["shed", snapshot.shed],
      ] as const)
    : [];

  return (
    <section aria-labelledby="load-title" className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-5 shadow-panel lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="load-title" className="flex items-center gap-2 font-semibold">
            <Gauge className="size-4" aria-hidden />
            {t("tn.load.panel_title")}
          </h2>
          <p className="text-[0.8125rem] text-muted-foreground">{t("tn.load.panel_subtitle")}</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <Switch checked={snapshot?.forced ?? false} onCheckedChange={(next) => void force(next)} />
          {t("tn.load.force")}
        </label>
      </div>
      {snapshot ? (
        <>
          <p role="status" className={cn("rounded-xl px-3 py-2 text-sm font-semibold", snapshot.level === "normal" ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}>
            {t(`tn.load.level.${snapshot.level}` as MessageKey)}
          </p>
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
            {figures.map(([key, value]) => (
              <div key={key} className="rounded-xl bg-surface-muted px-3 py-2">
                <dd className="text-lg font-semibold tabular-nums">{value}</dd>
                <dt className="text-[0.75rem] text-muted-foreground">{t(`tn.load.figure.${key}` as MessageKey)}</dt>
              </div>
            ))}
          </dl>
        </>
      ) : null}
    </section>
  );
}
