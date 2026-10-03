"use client";

import { AlertTriangle, Loader2, Radio, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/feedback/empty-state";
import { useI18n, useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { useFormatters } from "@/hooks/use-formatters";
import { useSocket } from "@/hooks/use-socket";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { localizeServerMessage } from "@/lib/i18n/server-messages";
import { SOCKET_EVENTS } from "@/lib/socket/events";
import { cn } from "@/lib/utils";
import { minutesUntil, nextWaveAt } from "@/modules/webcup/webcup.schedule";
import type { WebcupFeedDto, WebcupRequestDto } from "@/modules/webcup/webcup.service";

import { WebcupRequestCard } from "./webcup-request-card";

/**
 * D19 — the agents read what the Nova Terra API sends. The server polls the
 * API and pushes `webcup:feed` when new requests arrive; this view refetches
 * then, and a manual refresh is there for impatient humans.
 */
export function WebcupFeedView({ initial }: { readonly initial: WebcupFeedDto }) {
  const t = useTranslation();
  const { locale } = useI18n();
  const fmt = useFormatters();
  const { socket } = useSocket();
  const [feed, setFeed] = useState(initial);
  const [filter, setFilter] = useState<"all" | "todo">("all");
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const reload = useCallback(async () => {
    try {
      setFeed((await apiFetch<{ data: WebcupFeedDto }>("/api/webcup/feed")).data);
    } catch {
      // The next push or refresh tries again; the current list stays on screen.
    }
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onFeed = (payload: { added: string[] }) => {
      if (payload.added.length > 0) toast.info(t("tn.agent.feed.live", { codes: payload.added.join(", ") }));
      void reload();
    };
    socket.on(SOCKET_EVENTS.webcupFeed, onFeed);
    return () => {
      socket.off(SOCKET_EVENTS.webcupFeed, onFeed);
    };
  }, [socket, reload, t]);

  // Keeps the countdown and "last sync" fresh, and catches syncs missed while offline.
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
      void reload();
    }, 60_000);
    return () => clearInterval(timer);
  }, [reload]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const response = await apiFetch<{ data: { added: string[]; feed: WebcupFeedDto } }>("/api/webcup/refresh", { method: "POST" });
      setFeed(response.data.feed);
      toast.success(t("tn.agent.feed.refreshed", { added: response.data.added.length }));
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setRefreshing(false);
      setNow(Date.now());
    }
  };

  const update = (next: WebcupRequestDto) =>
    setFeed((current) => ({ ...current, requests: current.requests.map((item) => (item.code === next.code ? next : item)) }));

  const requests = useMemo(
    () => feed.requests.filter((request) => filter === "all" || request.triage === "TODO" || request.triage === "IN_PROGRESS"),
    [feed.requests, filter],
  );
  const visible = feed.requests.filter((request) => request.visible);
  const xpVisible = visible.reduce((sum, request) => sum + request.xpAvailable, 0);
  const xpDone = visible.filter((request) => request.triage === "DONE").reduce((sum, request) => sum + request.xpAvailable, 0);
  const session = feed.session;
  const minutesLeft = minutesUntil(nextWaveAt(session?.minutes_until_next_wave, feed.lastSuccessAt), now);

  const stats = [
    { label: t("tn.agent.feed.session"), value: session?.status ?? "—" },
    { label: t("tn.agent.feed.wave"), value: session?.current_wave ?? "—" },
    {
      label: t("tn.agent.feed.next_wave"),
      value: session?.next_wave_number != null ? `${session.next_wave_number}` : "—",
      hint: minutesLeft != null ? t("tn.agent.feed.next_in", { minutes: minutesLeft }) : null,
    },
    { label: t("tn.agent.feed.visible"), value: visible.length },
    { label: t("tn.agent.feed.xp"), value: xpVisible },
    { label: t("tn.agent.feed.xp_done"), value: xpDone },
  ];

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Radio className="size-5 text-primary" aria-hidden />
            {t("tn.agent.feed.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("tn.agent.feed.subtitle")}</p>
          <p className="text-[12.5px] text-muted-foreground">
            {feed.lastSuccessAt ? t("tn.agent.feed.last_sync", { when: fmt.relative(feed.lastSuccessAt) }) : t("tn.agent.feed.never")}
          </p>
        </div>
        <Button onClick={() => void refresh()} disabled={refreshing || !feed.configured} variant="secondary">
          {refreshing ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
          {t("tn.agent.feed.refresh")}
        </Button>
      </header>

      {!feed.configured ? (
        <p role="alert" className="flex items-start gap-2 rounded-2xl border border-warning/50 bg-warning/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("tn.agent.feed.not_configured")}
        </p>
      ) : feed.lastError ? (
        <p role="alert" className="flex items-start gap-2 rounded-2xl border border-error/40 bg-error/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("tn.agent.feed.error", { error: localizeServerMessage(feed.lastError, locale) })}
        </p>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-0.5 rounded-2xl border border-border/70 bg-card p-3 shadow-panel">
            <dt className="text-[12px] text-muted-foreground">{stat.label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{stat.value}</dd>
            {stat.hint ? <dd className="text-[12px] text-primary">{stat.hint}</dd> : null}
          </div>
        ))}
      </dl>

      <div className="flex gap-1.5" role="group">
        {(["all", "todo"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[13px] font-medium",
              filter === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-surface-muted",
            )}
          >
            {value === "all" ? t("tn.agent.feed.filter_all") : t("tn.agent.feed.filter_todo")}
          </button>
        ))}
      </div>

      {requests.length === 0 ? (
        <EmptyState icon={Radio} title={t("tn.agent.feed.empty_title")} description={t("tn.agent.feed.empty_body")} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {requests.map((request) => (
            <WebcupRequestCard key={request.code} request={request} onChanged={update} />
          ))}
        </div>
      )}
    </div>
  );
}
