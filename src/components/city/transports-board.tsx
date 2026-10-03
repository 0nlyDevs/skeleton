"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { BusFront, Clock3, Heart, Search, Siren, Route } from "lucide-react";

import { ContextTip } from "@/components/feedback/context-tip";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "@/components/ui/link";
import type { TransportLineDto } from "@/modules/transports/transports.service";

function minutes(time: string) { const [hour, minute] = time.split(":").map(Number); return hour * 60 + minute; }
function clock(value: number) { return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`; }
function nextTimes(line: TransportLineDto, current: number | null) {
  if (current === null) return [];
  const first = minutes(line.firstDeparture); const last = minutes(line.lastDeparture);
  const start = current <= first ? first : first + Math.ceil((current - first) / line.headwayMinutes) * line.headwayMinutes;
  return Array.from({ length: 3 }, (_, index) => start + index * line.headwayMinutes).filter((value) => value <= last).map(clock);
}

/*
 * The clock only exists in the browser: the server renders no departure time,
 * so the HTML it sends never disagrees with the first client render (no
 * hydration mismatch), and the times refresh every 30 seconds.
 */
const TICK_MS = 30_000;
function subscribeClock(onChange: () => void) {
  const timer = setInterval(onChange, TICK_MS);
  return () => clearInterval(timer);
}
const clockSnapshot = () => Math.floor(Date.now() / TICK_MS);
const serverClock = () => null;

/** Favourite lines, by id, kept in this browser. Storage can be unavailable: then they last until reload. */
const FAVORITES_KEY = "tn-transport-favorites";
const favoriteListeners = new Set<() => void>();
let favoritesFallback = "[]";
function readFavorites(): string {
  try {
    return window.localStorage.getItem(FAVORITES_KEY) ?? "[]";
  } catch {
    return favoritesFallback;
  }
}
function writeFavorites(ids: readonly string[]): void {
  favoritesFallback = JSON.stringify(ids);
  try {
    window.localStorage.setItem(FAVORITES_KEY, favoritesFallback);
  } catch {
    // Private mode or blocked storage: the in-memory copy still works.
  }
  for (const listener of favoriteListeners) listener();
}
function subscribeFavorites(onChange: () => void) {
  favoriteListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    favoriteListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}
function parseIds(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function TransportsBoard({ lines }: { readonly lines: readonly TransportLineDto[] }) {
  const t = useTranslation();
  const [query, setQuery] = useState("");
  const tick = useSyncExternalStore(subscribeClock, clockSnapshot, serverClock);
  const current = tick === null ? null : (() => {
    const now = new Date(tick * TICK_MS);
    return now.getHours() * 60 + now.getMinutes();
  })();
  const favoritesRaw = useSyncExternalStore(subscribeFavorites, readFavorites, () => "[]");
  const favorites = useMemo(() => parseIds(favoritesRaw), [favoritesRaw]);
  const toggleFavorite = (id: string) => writeFavorites(favorites.includes(id) ? favorites.filter((item) => item !== id) : [...favorites, id]);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const stops = useMemo(() => [...new Set(lines.flatMap((line) => line.stops))].sort((a, b) => a.localeCompare(b)), [lines]);
  const hasAlerts = lines.some((line) => Boolean(line.alert));
  const itinerary = useMemo(() => lines.flatMap((line) => {
    const from = line.stops.indexOf(origin); const to = line.stops.indexOf(destination);
    return origin && destination && from >= 0 && to > from ? [{ line, from, to }] : [];
  }), [lines, origin, destination]);
  const matching = useMemo(() => {
    const value = query.trim().toLocaleLowerCase();
    const found = value ? lines.filter((line) => `${line.code} ${line.name} ${line.stops.join(" ")}`.toLocaleLowerCase().includes(value)) : lines;
    // Favourite lines first, in their usual order otherwise.
    return [...found].sort((a, b) => Number(favorites.includes(b.id)) - Number(favorites.includes(a.id)));
  }, [lines, query, favorites]);
  const favoriteCodes = lines.filter((line) => favorites.includes(line.id)).map((line) => line.code);

  // A plain wrapper: the app shell already provides the page's single <main>.
  return <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
    <header className="flex flex-col gap-1"><p className="text-sm font-medium text-primary">{t("tn.transports.status.title")}</p><h1 className="text-3xl font-semibold tracking-tight">{t("tn.transports.title")}</h1><p className="max-w-2xl text-sm text-muted-foreground">{t("tn.transports.subtitle")}</p></header>
    <div role="status" className={`flex items-center gap-3 rounded-xl border p-4 text-sm ${hasAlerts ? "border-warning/30 bg-warning/5" : "border-success/30 bg-success/5"}`}><span className={`size-2.5 rounded-full ${hasAlerts ? "bg-warning" : "bg-success"}`} aria-hidden /><span className="font-medium">{t(hasAlerts ? "tn.transports.status.disrupted" : "tn.transports.status.all_good")}</span><span className="ml-auto hidden text-muted-foreground sm:inline">{t("tn.transports.schedule_note")}</span></div>

    {lines.length === 0 ? <Card><CardContent className="p-6 text-sm text-muted-foreground">{t("tn.transports.no_published_lines")}</CardContent></Card> : <>
      <ContextTip id="transports">{t("tn.tip.transports")}</ContextTip>
      <Card><CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="flex flex-col gap-1.5 text-sm font-medium"><span id="transport-origin-label">{t("tn.transports.origin")}</span><Select value={origin} onValueChange={setOrigin}><SelectTrigger aria-labelledby="transport-origin-label"><SelectValue placeholder={t("tn.transports.choose_stop")} /></SelectTrigger><SelectContent>{stops.map((stop) => <SelectItem key={stop} value={stop}>{stop}</SelectItem>)}</SelectContent></Select></div>
        <div className="flex flex-col gap-1.5 text-sm font-medium"><span id="transport-destination-label">{t("tn.transports.destination")}</span><Select value={destination} onValueChange={setDestination}><SelectTrigger aria-labelledby="transport-destination-label"><SelectValue placeholder={t("tn.transports.choose_stop")} /></SelectTrigger><SelectContent>{stops.filter((stop) => stop !== origin).map((stop) => <SelectItem key={stop} value={stop}>{stop}</SelectItem>)}</SelectContent></Select></div>
        <span className="pb-2 text-xs text-muted-foreground">{t("tn.transports.direct_routes_only")}</span>
      </CardContent></Card>
      {origin && destination ? <section aria-label={t("tn.transports.itinerary")} className="flex flex-col gap-2">
        {itinerary.length ? itinerary.map(({ line, from, to }) => <Card key={line.id}><CardContent className="flex flex-wrap items-center gap-3 p-4"><Route className="size-5 text-primary" aria-hidden /><span className="grid size-8 place-items-center rounded-lg bg-accent font-bold">{line.code}</span><span className="min-w-0 flex-1"><span className="block font-medium">{line.name}</span><span className="block text-sm text-muted-foreground">{line.stops.slice(from, to + 1).join(" → ")}</span></span><Badge variant="primary">{current === null ? "…" : (nextTimes(line, current)[0] ?? t("tn.transports.no_more_departures"))}</Badge></CardContent></Card>) : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{t("tn.transports.no_direct_route")}</p>}
      </section> : null}

      <label className="relative block"><span className="sr-only">{t("tn.transports.search_label")}</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("tn.transports.search_stop")} className="h-12 pl-10" /></label>
      {favoriteCodes.length > 0 ? <p className="text-sm text-muted-foreground">{t("tn.transports.favorite_lines", { lines: favoriteCodes.join(", ") })}</p> : null}
      <section aria-label={t("tn.transports.next_departures")} className="grid gap-4">
        {matching.map((line) => <Card key={line.id}><CardContent className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary text-lg font-bold text-primary-foreground"><BusFront aria-hidden /></span><div className="min-w-0 flex-1"><h2 className="font-semibold">{line.code} · {line.name}</h2>{line.description ? <p className="text-sm text-muted-foreground">{line.description}</p> : null}<p className="text-sm text-muted-foreground">{line.stops.join("  ·  ")}</p></div><button type="button" onClick={() => toggleFavorite(line.id)} aria-pressed={favorites.includes(line.id)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-surface-muted" aria-label={favorites.includes(line.id) ? t("tn.transports.favorite_remove_line", { code: line.code }) : t("tn.transports.favorite_add_line", { code: line.code })}><Heart className={`size-4 ${favorites.includes(line.id) ? "fill-current text-error" : ""}`} aria-hidden /><span className="hidden sm:inline">{t("tn.transports.favorite_short")}</span></button></div>
          <div className="grid gap-3 rounded-xl bg-surface-muted/50 p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="mb-2 flex items-center gap-2 text-sm font-medium"><Clock3 className="size-4" aria-hidden />{t("tn.transports.next_departures")}</p><div className="flex flex-wrap gap-2">{current === null ? <span className="text-sm text-muted-foreground">{t("tn.transports.loading_times")}</span> : nextTimes(line, current).length === 0 ? <span className="text-sm text-muted-foreground">{t("tn.transports.no_more_departures")}</span> : nextTimes(line, current).map((time, index) => <Badge key={time} variant={index === 0 ? "primary" : "neutral"}>{time}</Badge>)}</div></div><p className="text-sm text-muted-foreground">{t("tn.transports.frequency_interval", { min: line.headwayMinutes })}<br />{t("tn.transports.hours", { first: line.firstDeparture, last: line.lastDeparture })}<br />{line.serviceDays}</p></div>
          {line.alert ? <p className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm"><Siren className="size-4 shrink-0" aria-hidden />{line.alert}</p> : null}
        </CardContent></Card>)}
        {matching.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{t("tn.transports.no_results")}</p> : null}
      </section>
    </>}
    <p className="text-xs text-muted-foreground">{t("tn.transports.data_disclaimer")} <Link href="/contact?type=issue" className="text-primary underline">{t("tn.transports.report_issue")}</Link></p>
  </div>;
}
