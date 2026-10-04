"use client";

import { AlertTriangle, Loader2, Radio, RefreshCw, Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/feedback/empty-state";
import { useI18n, useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFormatters } from "@/hooks/use-formatters";
import { useSocket } from "@/hooks/use-socket";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import type { MessageKey } from "@/lib/i18n";
import { localizeServerMessage } from "@/lib/i18n/server-messages";
import { SOCKET_EVENTS } from "@/lib/socket/events";
import { cn } from "@/lib/utils";
import { minutesUntil, nextWaveAt } from "@/modules/webcup/webcup.schedule";
import type { WebcupFeedDto, WebcupRequestDto } from "@/modules/webcup/webcup.service";

import { WebcupRequestCard } from "./webcup-request-card";

export const FEED_STATUS_FILTERS = [
  { id: "all", labelKey: "tn.agent.feed.filter_all" },
  { id: "TODO", labelKey: "tn.triage.TODO" },
  { id: "IN_PROGRESS", labelKey: "tn.triage.IN_PROGRESS" },
  { id: "DONE", labelKey: "tn.triage.DONE" },
  { id: "SKIPPED", labelKey: "tn.triage.SKIPPED" },
] as const;

export type FeedStatusFilter = (typeof FEED_STATUS_FILTERS)[number]["id"];

const DIFFICULTY_FILTERS = ["all", "1", "2", "3", "4", "unknown"] as const;
type DifficultyFilter = (typeof DIFFICULTY_FILTERS)[number];

function parseDifficulty(value?: string | null): DifficultyFilter {
  return DIFFICULTY_FILTERS.find((item) => item === value) ?? "all";
}

function parseStatus(value?: string | null): FeedStatusFilter {
  if (!value) return "all";
  const match = FEED_STATUS_FILTERS.find((f) => f.id.toLowerCase() === value.toLowerCase() || f.id === value);
  return match ? match.id : "all";
}

/**
 * D19 — the agents read what the Nova Terra API sends. The server polls the
 * API and pushes `webcup:feed` when new requests arrive; this view refetches
 * then, and a manual refresh is there for impatient humans.
 */
export function WebcupFeedView({
  initial,
  initialStatus,
  initialDifficulty,
  initialQuery,
}: {
  readonly initial: WebcupFeedDto;
  readonly initialStatus?: string;
  readonly initialDifficulty?: string;
  readonly initialQuery?: string;
}) {
  const t = useTranslation();
  const { locale } = useI18n();
  const fmt = useFormatters();
  const { socket } = useSocket();
  const router = useRouter();
  const pathname = usePathname();

  const [feed, setFeed] = useState(initial);
  const [filter, setFilter] = useState<FeedStatusFilter>(() => parseStatus(initialStatus));
  const [difficulty, setDifficulty] = useState<DifficultyFilter>(() => parseDifficulty(initialDifficulty));
  const [q, setQ] = useState(initialQuery ?? "");
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const syncUrl = useCallback(
    (nextFilter: FeedStatusFilter, nextDifficulty: DifficultyFilter, nextQ: string) => {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      if (nextFilter === "all") params.delete("status");
      else params.set("status", nextFilter);

      if (nextDifficulty === "all") params.delete("difficulty");
      else params.set("difficulty", nextDifficulty);

      const trimmed = nextQ.trim();
      if (!trimmed) params.delete("q");
      else params.set("q", trimmed);

      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const pickFilter = (next: FeedStatusFilter) => {
    setFilter(next);
    syncUrl(next, difficulty, q);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      syncUrl(filter, difficulty, q);
    }, 300);
    return () => clearTimeout(timer);
  }, [q, filter, difficulty, syncUrl]);

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

  const counts = useMemo(() => {
    const list = feed.requests;
    return {
      all: list.length,
      TODO: list.filter((r) => r.triage === "TODO").length,
      IN_PROGRESS: list.filter((r) => r.triage === "IN_PROGRESS").length,
      DONE: list.filter((r) => r.triage === "DONE").length,
      SKIPPED: list.filter((r) => r.triage === "SKIPPED").length,
    };
  }, [feed.requests]);

  const requests = useMemo(() => {
    const query = q.trim().toLowerCase();
    return feed.requests.filter((request) => {
      if (filter !== "all") {
        if (request.triage !== filter) return false;
      }

      if (difficulty !== "all") {
        const level = request.difficultyLevel;
        if (difficulty === "unknown" ? level != null : level == null || String(level) !== difficulty) return false;
      }

      if (query) {
        const inCode = request.code.toLowerCase().includes(query);
        const inMessage = request.message.toLowerCase().includes(query);
        const inRequester =
          (request.requesterName ?? "").toLowerCase().includes(query) ||
          (request.requesterType ?? "").toLowerCase().includes(query);
        const inGroup = (request.groupName ?? "").toLowerCase().includes(query);
        if (!inCode && !inMessage && !inRequester && !inGroup) return false;
      }

      return true;
    });
  }, [feed.requests, filter, difficulty, q]);

  const visible = feed.requests.filter((request) => request.visible);
  const xpVisible = visible.reduce((sum, request) => sum + request.xpAvailable, 0);
  const xpDone = visible.filter((request) => request.triage === "DONE").reduce((sum, request) => sum + request.xpAvailable, 0);
  const session = feed.session;
  const minutesLeft = minutesUntil(nextWaveAt(session?.minutes_until_next_wave, feed.lastSuccessAt), now);

  const stats = [
    { label: t("tn.agent.feed.session"), value: session?.status ?? "-" },
    { label: t("tn.agent.feed.wave"), value: session?.current_wave ?? "-" },
    {
      label: t("tn.agent.feed.next_wave"),
      value: session?.next_wave_number != null ? `${session.next_wave_number}` : "-",
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
          <p className="text-[0.7812rem] text-muted-foreground">
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
            <dt className="text-[0.75rem] text-muted-foreground">{stat.label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{stat.value}</dd>
            {stat.hint ? <dd className="text-[0.75rem] text-primary">{stat.hint}</dd> : null}
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder={t("tn.agent.feed.search")}
            aria-label={t("tn.agent.feed.search")}
            className="pl-9 pr-9"
            maxLength={80}
          />
          {q ? (
            <button
              type="button"
              onClick={() => {
                setQ("");
                syncUrl(filter, difficulty, "");
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={t("common.reset")}
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      <nav aria-label={t("tn.agent.feed.filter_status")} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {FEED_STATUS_FILTERS.map((item) => {
          const count = counts[item.id];
          const active = filter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => pickFilter(item.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors",
                active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-surface-muted",
              )}
            >
              <span>{t(item.labelKey as MessageKey)}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums",
                  active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="feed-difficulty" className="text-sm font-medium">{t("tn.agent.feed.filter_difficulty")}</label>
        <select
          id="feed-difficulty"
          value={difficulty}
          onChange={(event) => {
            const next = parseDifficulty(event.target.value);
            setDifficulty(next);
            syncUrl(filter, next, q);
          }}
          className="h-9 rounded-lg border border-border bg-card px-3 text-sm"
        >
          {DIFFICULTY_FILTERS.map((item) => (
            <option key={item} value={item}>{t(`tn.agent.feed.difficulty_${item}` as MessageKey)}</option>
          ))}
        </select>
      </div>

      {feed.requests.length === 0 ? (
        <EmptyState icon={Radio} title={t("tn.agent.feed.empty_title")} description={t("tn.agent.feed.empty_body")} />
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/80 bg-card/40 p-10 text-center">
          <EmptyState icon={Radio} title={t("tn.agent.feed.filter_empty_title")} description={t("tn.agent.feed.filter_empty_body")} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFilter("all");
              setQ("");
              setDifficulty("all");
              syncUrl("all", "all", "");
            }}
          >
            {t("tn.agent.feed.reset_filters")}
          </Button>
        </div>
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
