"use client";

import { ShieldAlert, Siren, TriangleAlert, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Link from "@/components/ui/link";
import { useSocket } from "@/hooks/use-socket";
import { apiFetch } from "@/lib/api/client";
import type { MessageKey } from "@/lib/i18n";
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
 * Makes alerts impossible to miss for the people they concern. A warning or
 * a critical alert that reaches the viewer's district (or the whole city)
 * opens a dialog once, then stays as a banner until it is resolved; an
 * information notice is a toast. Everything refreshes on the realtime event.
 */
export function AlertWatcher() {
  const t = useTranslation();
  const pathname = usePathname();
  const { socket } = useSocket();
  const [alerts, setAlerts] = useState<readonly ViewerAlert[]>([]);
  const [popup, setPopup] = useState<ViewerAlert | null>(null);
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
    const urgent = fresh.find((item) => item.severity !== "INFORMATION");
    if (urgent) setPopup((current) => current ?? urgent);
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

  const close = () => {
    if (popup) acknowledge(popup.slug);
    setPopup(null);
    // Another unacknowledged urgent alert, if any, comes next.
    const seen = acknowledged();
    const next = alerts.filter((item) => item.severity !== "INFORMATION" && !seen.has(item.slug)).sort((a, b) => RANK[b.severity] - RANK[a.severity])[0];
    if (next) setTimeout(() => setPopup(next), 250);
  };

  const urgent = [...alerts].filter((item) => item.severity !== "INFORMATION").sort((a, b) => RANK[b.severity] - RANK[a.severity])[0];
  const onAlertPage = urgent ? pathname === `/alerts/${urgent.slug}` : false;
  const critical = popup?.severity === "CRITICAL";

  return (
    <>
      {urgent && !bannerHidden && !onAlertPage ? (
        <div
          role="alert"
          className={cn(
            "mb-4 flex items-center gap-3 rounded-2xl border px-4 py-3 text-[0.875rem]",
            urgent.severity === "CRITICAL" ? "border-error/40 bg-error/10" : "border-warning/50 bg-warning/10",
          )}
        >
          {urgent.severity === "CRITICAL" ? <ShieldAlert className="size-5 shrink-0 text-error" aria-hidden /> : <TriangleAlert className="size-5 shrink-0 text-warning" aria-hidden />}
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{urgent.title}</p>
            <p className="truncate text-[0.8125rem] text-muted-foreground">{urgent.summary}</p>
          </div>
          <Button asChild size="sm" variant={urgent.severity === "CRITICAL" ? "destructive" : "secondary"}>
            <Link href={`/alerts/${encodeURIComponent(urgent.slug)}`}>{t("alerts.open")}</Link>
          </Button>
          <button type="button" onClick={() => setBannerHidden(true)} aria-label={t("common.close")} className="grid size-8 place-items-center rounded-full hover:bg-black/5">
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}

      <Dialog open={popup !== null} onOpenChange={(open) => !open && close()}>
        {popup ? (
          <DialogContent className={cn("border-2", critical ? "border-error/60" : "border-warning/60")}>
            <DialogHeader>
              <span className={cn("mb-2 grid size-12 place-items-center rounded-2xl", critical ? "bg-error/12 text-error" : "bg-warning/14 text-warning")}>
                <Siren className="size-6" aria-hidden />
              </span>
              <p className={cn("text-[0.75rem] font-semibold uppercase tracking-wide", critical ? "text-error" : "text-warning")}>
                {t(`alerts.severity.${popup.severity}` as MessageKey)} · {popup.scope === "ALL" ? t("alerts.popup.everyone") : t("alerts.popup.title")}
              </p>
              <DialogTitle className="text-[1.25rem]">{popup.title}</DialogTitle>
              <DialogDescription className="text-[0.9375rem]">{popup.summary}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="ghost" onClick={close}>
                {t("alerts.popup.later")}
              </Button>
              <Button asChild variant={critical ? "destructive" : "primary"} onClick={close}>
                <Link href={`/alerts/${encodeURIComponent(popup.slug)}`}>{t("alerts.popup.read")}</Link>
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}
