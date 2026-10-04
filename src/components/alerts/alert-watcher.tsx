"use client";

import { ShieldAlert, TriangleAlert, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { useSocket } from "@/hooks/use-socket";
import { apiFetch } from "@/lib/api/client";
import { SOCKET_EVENTS } from "@/lib/socket/events";
import { cn } from "@/lib/utils";
import type { AlertsForViewerDto } from "@/modules/alerts/alerts.service";

type ViewerAlert = AlertsForViewerDto["alerts"][number];

const ACK_KEY = "tn-alert-ack";
const RANK = { INFORMATION: 0, WARNING: 1, CRITICAL: 2 } as const;

function acknowledged(): Set<string> {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(ACK_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function acknowledge(slug: string): void {
  try {
    const list = [...acknowledged(), slug].slice(-60);
    window.localStorage.setItem(ACK_KEY, JSON.stringify(list));
  } catch {
    // Private mode: the popup may come back on the next visit, which is safe.
  }
}

/**
 * Makes alerts hard to miss without ever blocking the page. A warning or a
 * critical alert that reaches the viewer's district (or the whole city) is
 * one line above the page until it is resolved; an information notice is a
 * notice dropping from the top. Everything refreshes on the realtime event.
 */
export function AlertWatcher() {
  const t = useTranslation();
  const pathname = usePathname();
  const { socket } = useSocket();
  const [alerts, setAlerts] = useState<readonly ViewerAlert[]>([]);
  const [bannerHidden, setBannerHidden] = useState(false);

  const load = useCallback(async () => {
    let data: AlertsForViewerDto;
    try {
      data = (await apiFetch<{ data: AlertsForViewerDto }>("/api/alerts/for-me")).data;
    } catch {
      return;
    }
    setAlerts(data.alerts);
    const seen = acknowledged();
    const fresh = data.alerts.filter((alert) => !seen.has(alert.slug)).sort((a, b) => RANK[b.severity] - RANK[a.severity]);
    for (const alert of fresh.filter((item) => item.severity === "INFORMATION")) {
      toast(alert.title, { description: alert.summary, duration: 10_000 });
      acknowledge(alert.slug);
    }
    // Urgent alerts never block the page: they stay as one line until resolved.
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const onChange = () => {
      setBannerHidden(false);
      void load();
    };
    socket.on(SOCKET_EVENTS.cityAlertUpdated, onChange);
    return () => {
      socket.off(SOCKET_EVENTS.cityAlertUpdated, onChange);
    };
  }, [socket, load]);

  const urgent = [...alerts].filter((item) => item.severity !== "INFORMATION").sort((a, b) => RANK[b.severity] - RANK[a.severity])[0];
  const onAlertPage = urgent ? pathname === `/alerts/${urgent.slug}` : false;

  return (
    <>
      {urgent && !bannerHidden && !onAlertPage ? (
        <div
          role="alert"
          className={cn(
            "mb-5 flex items-center gap-3 rounded-full border py-2 pl-4 pr-2 text-[0.875rem]",
            urgent.severity === "CRITICAL" ? "border-error/40 bg-error/10" : "border-warning/50 bg-warning/10",
          )}
        >
          {urgent.severity === "CRITICAL" ? <ShieldAlert className="size-5 shrink-0 text-error" aria-hidden /> : <TriangleAlert className="size-5 shrink-0 text-warning" aria-hidden />}
          <div className="min-w-0 flex-1">
            <p className="truncate">
              <span className="font-semibold">{urgent.title}</span>
              <span className="hidden text-muted-foreground sm:inline"> · {urgent.summary}</span>
            </p>
          </div>
          <Button asChild size="sm" variant={urgent.severity === "CRITICAL" ? "destructive" : "secondary"}>
            <Link href={`/alerts/${encodeURIComponent(urgent.slug)}`}>{t("alerts.open")}</Link>
          </Button>
          <button type="button" onClick={() => setBannerHidden(true)} aria-label={t("common.close")} className="grid size-8 place-items-center rounded-full hover:bg-black/5">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}

    </>
  );
}
