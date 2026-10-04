"use client";

import {
  Ambulance,
  Building2,
  Phone,
  Bus,
  Compass,
  Home,
  Landmark,
  Layers,
  List,
  Loader2,
  LocateFixed,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Trees,
  Users,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import { ServiceAvailabilityBadge } from "@/components/city/service-availability-notice";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ServiceAvailabilityDto } from "@/modules/city-services/service-availability";
import Link from "@/components/ui/link";
import { useSocket } from "@/hooks/use-socket";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import type { MessageKey } from "@/lib/i18n";
import { SOCKET_EVENTS } from "@/lib/socket/events";
import { cn } from "@/lib/utils";
import type { ZoneStatusDto } from "@/modules/alerts/alerts.service";
import { CITY_PLACES, PLACE_KINDS, type PlaceKind } from "@/modules/alerts/city-map-data";
import {
  CITY_REGION_IDS,
  CITY_ZONES,
  CITY_ZONE_VERTICES,
  ZONE_STATUSES,
  cityRegionLabelKey,
  cityZoneLabelKey,
  type CityRegionId,
  type CityZoneId,
} from "@/modules/alerts/city-zones";

import { ServiceIcon } from "@/components/city/service-icon";

import type { CityMapScene, ServiceLayer } from "./city-map-scene";

/** A municipal service with premises, as the map shows it. */
export interface MapService {
  readonly slug: string;
  readonly name: string;
  readonly category: string;
  readonly icon: string;
  readonly emergency: boolean;
  readonly hours: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  readonly x: number;
  readonly y: number;
  readonly zone: CityZoneId;
  /** F38 — stopped or about to be; said on the card before "Faire une demande". */
  readonly availability: ServiceAvailabilityDto;
}

const STATUS_COLORS = { SAFE: "#2fae7a", WATCH: "#3f8fd9", WARNING: "#f29d2a", DANGER: "#e5484d" } as const;
const STATUS_RANK = (status: ZoneStatusDto["status"]) => ZONE_STATUSES.indexOf(status);
const KIND_ICON: Readonly<Record<PlaceKind, LucideIcon>> = {
  SIGHT: Landmark,
  TRANSIT: Bus,
  STAY: Building2,
  FOOD: UtensilsCrossed,
  MARKET: ShoppingBag,
  NATURE: Trees,
};
export const KIND_COLOR: Readonly<Record<PlaceKind, string>> = {
  SIGHT: "#1a73e8",
  TRANSIT: "#188038",
  STAY: "#a142f4",
  FOOD: "#e8710a",
  MARKET: "#d93025",
  NATURE: "#0b8043",
};

type Selection =
  | { readonly type: "zone"; readonly zone: CityZoneId }
  | { readonly type: "place"; readonly index: number }
  | { readonly type: "service"; readonly slug: string }
  | null;

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function normalise(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/**
 * The city map, laid out like the map apps people already know: search and
 * categories at the top left, controls at the bottom right, one card for what
 * is selected. The districts list carries the same information for keyboards
 * and screen readers; without WebGL a flat map replaces the 3D view.
 */
export function CityMapView({
  initial,
  viewerZone,
  signedIn,
  services,
  focus,
}: {
  readonly initial: readonly ZoneStatusDto[];
  readonly viewerZone: CityZoneId | null;
  readonly signedIn: boolean;
  readonly services: readonly MapService[];
  /** Deep link: a service to open, or the emergency layer. */
  readonly focus: { readonly service?: string; readonly layer?: "emergency"; readonly zone?: CityZoneId };
}) {
  const t = useTranslation();
  const { resolvedTheme } = useTheme();
  const { socket } = useSocket();
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CityMapScene | null>(null);
  const [statuses, setStatuses] = useState<readonly ZoneStatusDto[]>(initial);
  const [selection, setSelection] = useState<Selection>(focus.service ? { type: "service", slug: focus.service } : focus.zone ? { type: "zone", zone: focus.zone } : null);
  const [serviceLayer, setServiceLayer] = useState<ServiceLayer>(focus.layer === "emergency" ? "emergency" : "all");
  const serviceBySlug = useMemo(() => new Map(services.map((service) => [service.slug, service])), [services]);
  const [region, setRegion] = useState<CityRegionId | null>(null);
  const [kinds, setKinds] = useState<ReadonlySet<PlaceKind> | null>(null);
  const [home, setHome] = useState<CityZoneId | null>(viewerZone);
  const [mode, setMode] = useState<"loading" | "3d" | "flat">("loading");
  // Light mode (slow connection or the resident's choice) starts on the flat
  // map: no three.js download until the resident asks for the 3D view.
  const [want3d, setWant3d] = useState(false);
  const [canShow3d, setCanShow3d] = useState(false);
  const [flat, setFlat] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [labelTargets, setLabelTargets] = useState<{
    zones: ReadonlyMap<CityZoneId, HTMLDivElement>;
    places: readonly (HTMLDivElement | undefined)[];
    services: ReadonlyMap<string, HTMLDivElement>;
  } | null>(null);

  const byZone = useMemo(() => new Map(statuses.map((entry) => [entry.zone, entry])), [statuses]);
  // A city-wide information notice is not an alert: only caution and danger count.
  const alerted = statuses.filter((entry) => entry.status === "WARNING" || entry.status === "DANGER");
  const zoneName = useCallback((zone: CityZoneId) => t(cityZoneLabelKey(zone)), [t]);
  const statusLabel = (status: ZoneStatusDto["status"]) => t(`alerts.zone_status.${status}` as MessageKey);

  const refresh = useCallback(async () => {
    try {
      setStatuses((await apiFetch<{ data: ZoneStatusDto[] }>("/api/alerts/zones")).data);
    } catch {
      // The last known state stays on screen.
    }
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onChange = () => void refresh();
    socket.on(SOCKET_EVENTS.cityAlertUpdated, onChange);
    return () => {
      socket.off(SOCKET_EVENTS.cityAlertUpdated, onChange);
    };
  }, [socket, refresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!hasWebGL()) {
      setMode("flat");
      return;
    }
    if (document.documentElement.hasAttribute("data-eco") && !want3d) {
      setCanShow3d(true);
      setMode("flat");
      return;
    }
    setMode("loading");
    let disposed = false;
    void import("./city-map-scene").then(({ CityMapScene }) => {
      if (disposed) return;
      const scene = new CityMapScene(container, {
        onSelectZone: (zone) => setSelection(zone ? { type: "zone", zone } : null),
        onSelectPlace: (index) => setSelection({ type: "place", index }),
        onSelectService: (slug) => setSelection({ type: "service", slug }),
      });
      scene.bindPlaceClicks();
      const serviceTargets = scene.setServices(services.map(({ slug, x, y, emergency }) => ({ slug, x, y, emergency })));
      sceneRef.current = scene;
      setLabelTargets({
        zones: new Map(CITY_ZONES.flatMap((zone) => {
          const element = scene.zoneLabelElement(zone.id);
          return element ? [[zone.id, element] as const] : [];
        })),
        places: CITY_PLACES.map((_, index) => scene.placeLabelElement(index)),
        services: serviceTargets,
      });
      setMode("3d");
    });
    return () => {
      disposed = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
    // `services` is read once: markers are placed when the scene starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want3d]);

  useEffect(() => sceneRef.current?.setDaylight(resolvedTheme === "dark"), [resolvedTheme, mode]);
  useEffect(() => sceneRef.current?.setStatuses(new Map(statuses.map((entry) => [entry.zone, entry.status]))), [statuses, mode]);
  useEffect(() => sceneRef.current?.setHome(home), [home, mode]);
  useEffect(() => sceneRef.current?.setCategories(kinds), [kinds, mode]);
  useEffect(() => sceneRef.current?.setServiceLayer(serviceLayer), [serviceLayer, mode]);
  useEffect(() => {
    sceneRef.current?.setHighlight(region ? CITY_ZONES.filter((zone) => zone.region === region).map((zone) => zone.id) : []);
  }, [region, mode]);
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (selection?.type === "place") {
      scene.selectZone(CITY_PLACES[selection.index]?.zone ?? null, false);
      scene.flyToPlace(selection.index);
    } else if (selection?.type === "service") {
      scene.selectZone(serviceBySlug.get(selection.slug)?.zone ?? null, false);
      scene.flyToService(selection.slug);
    } else {
      scene.selectZone(selection?.zone ?? null);
    }
  }, [selection, serviceBySlug, mode]);

  const results = useMemo(() => {
    const needle = normalise(query.trim());
    if (!needle) return [];
    const zones = CITY_ZONES.filter((zone) => normalise(zoneName(zone.id)).includes(needle)).map((zone) => ({ type: "zone" as const, zone: zone.id }));
    const places = CITY_PLACES.map((place, index) => ({ place, index }))
      .filter(({ place }) => normalise(place.name).includes(needle))
      .map(({ index }) => ({ type: "place" as const, index }));
    const matchingServices = services
      .filter((service) => normalise(`${service.name} ${service.category}`).includes(needle))
      .map((service) => ({ type: "service" as const, slug: service.slug }));
    return [...matchingServices, ...zones, ...places].slice(0, 8);
  }, [query, zoneName, services]);

  const saveHome = async (zone: CityZoneId) => {
    setSaving(true);
    try {
      await apiFetch("/api/users/me", { method: "PATCH", body: { cityZone: zone } });
      setHome(zone);
      toast.success(t("alerts.map.home_saved"));
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setSaving(false);
    }
  };

  const toggleKind = (kind: PlaceKind) => {
    setKinds((current) => {
      const next = new Set(current ?? []);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next.size ? next : null;
    });
  };

  const selectedService = selection?.type === "service" ? serviceBySlug.get(selection.slug) : undefined;
  const selectedZone =
    selection?.type === "zone" ? selection.zone : selection?.type === "place" ? CITY_PLACES[selection.index]?.zone : selectedService?.zone;
  // Emergency facilities, nearest to the resident's home first (or to the city centre).
  const homeCentre = (() => {
    const definition = CITY_ZONES.find((zone) => zone.id === home);
    if (!definition) return [500, 320] as const;
    const points = definition.polygon.map((key) => CITY_ZONE_VERTICES[key]);
    return [points.reduce((sum, point) => sum + point[0], 0) / points.length, points.reduce((sum, point) => sum + point[1], 0) / points.length] as const;
  })();
  const emergencies = services
    .filter((service) => service.emergency)
    .map((service) => ({ service, distance: Math.hypot(service.x - homeCentre[0], service.y - homeCentre[1]) }))
    .sort((a, b) => a.distance - b.distance);
  const zoneEntry = selectedZone ? byZone.get(selectedZone) : undefined;
  const ordered = [...statuses]
    .filter((entry) => !region || entry.region === region)
    .sort((a, b) => STATUS_RANK(b.status) - STATUS_RANK(a.status) || a.score - b.score);

  const control = "grid size-10 place-items-center bg-card text-foreground transition-colors hover:bg-accent focus-visible:outline-2";

  return (
    <div className="relative h-[calc(100dvh-7.5rem)] min-h-[520px] overflow-hidden rounded-3xl border border-border/70 bg-background shadow-panel">
      <h1 className="sr-only">{t("alerts.map.title")}</h1>
      <div ref={containerRef} className="absolute inset-0 isolate z-0" role="img" aria-label={t("alerts.map.subtitle")} />
      {mode === "loading" ? (
        <div className="absolute inset-0 grid place-items-center text-foreground">
          <Loader2 className="size-6 animate-spin" aria-hidden />
        </div>
      ) : null}
      {mode === "flat" ? (
        <FlatMap
          statuses={byZone}
          selected={selectedZone ?? null}
          home={home}
          onSelect={(zone) => setSelection({ type: "zone", zone })}
          zoneName={zoneName}
          services={serviceLayer === "none" ? [] : services.filter((service) => serviceLayer === "all" || service.emergency)}
          onSelectService={(slug) => setSelection({ type: "service", slug })}
        />
      ) : null}
      {mode === "flat" && canShow3d ? (
        <button
          type="button"
          onClick={() => setWant3d(true)}
          className="absolute right-3 top-28 z-10 rounded-full bg-card px-4 py-2 text-[0.8125rem] font-medium text-foreground shadow-md hover:bg-accent"
        >
          {t("tn.eco.map_3d")}
        </button>
      ) : null}

      {labelTargets
        ? CITY_ZONES.map((zone) => {
            const element = labelTargets.zones.get(zone.id);
            const entry = byZone.get(zone.id);
            if (!element || !entry) return null;
            return createPortal(
              <span className={cn("tn-map-zone-text", region && zone.region !== region && "opacity-40")}>
                {entry.status !== "SAFE" ? <span className="tn-map-zone-dot" style={{ background: STATUS_COLORS[entry.status] }} /> : null}
                {zoneName(zone.id)}
              </span>,
              element,
              `zone-${zone.id}`,
            );
          })
        : null}
      {labelTargets
        ? CITY_PLACES.map((place, index) => {
            const element = labelTargets.places[index];
            if (!element) return null;
            const Icon = KIND_ICON[place.kind];
            return createPortal(
              <button type="button" className="tn-map-pin" aria-label={place.name}>
                <span className="tn-map-pin-icon" style={{ background: KIND_COLOR[place.kind] }}>
                  <Icon className="size-3" aria-hidden />
                </span>
                <span className="tn-map-pin-name">{place.name}</span>
              </button>,
              element,
              `place-${index}`,
            );
          })
        : null}

      {labelTargets
        ? services.map((service) => {
            const element = labelTargets.services.get(service.slug);
            if (!element) return null;
            return createPortal(
              <button type="button" className="tn-map-pin" aria-label={service.name}>
                <span className={cn("tn-map-service-icon", service.emergency && "is-emergency")}>
                  {service.emergency ? <Ambulance className="size-3" aria-hidden /> : <Building2 className="size-3" aria-hidden />}
                </span>
                <span className="tn-map-pin-name">{service.name}</span>
              </button>,
              element,
              `service-${service.slug}`,
            );
          })
        : null}

      {/* Search and categories, top left. */}
      <div className="absolute left-3 top-3 flex w-[min(380px,calc(100%-1.5rem))] flex-col gap-2">
        <div className="relative">
          <div className="flex items-center rounded-full bg-card pl-4 pr-1.5 shadow-[0_2px_6px_rgb(0_0_0/0.28)]">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("alerts.map.search")}
              aria-label={t("alerts.map.search")}
              className="h-11 min-w-0 flex-1 bg-transparent px-3 text-[0.9375rem] text-foreground outline-none placeholder:text-muted-foreground"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} aria-label={t("common.close")} className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-accent">
                <X className="size-4" aria-hidden />
              </button>
            ) : null}
          </div>
          {results.length > 0 ? (
            <ul className="absolute inset-x-0 top-full z-10 mt-1.5 overflow-hidden rounded-2xl bg-card py-1 text-foreground shadow-[0_2px_8px_rgb(0_0_0/0.3)]">
              {results.map((result) => {
                const service = result.type === "service" ? serviceBySlug.get(result.slug) : undefined;
                const label = result.type === "zone" ? zoneName(result.zone) : result.type === "service" ? service?.name : CITY_PLACES[result.index]?.name;
                const detail =
                  result.type === "zone"
                    ? t(cityRegionLabelKey(CITY_ZONES.find((zone) => zone.id === result.zone)?.region ?? "CENTRAL"))
                    : result.type === "service"
                      ? `${service?.category ?? ""} · ${service ? zoneName(service.zone) : ""}`
                      : zoneName(CITY_PLACES[result.index]?.zone ?? "NOVA_PRIME");
                const Icon = result.type === "zone" ? Layers : result.type === "service" ? (service?.emergency ? Ambulance : Building2) : KIND_ICON[CITY_PLACES[result.index]?.kind ?? "SIGHT"];
                return (
                  <li key={result.type === "zone" ? result.zone : result.type === "service" ? `s${result.slug}` : `p${result.index}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelection(result);
                        setQuery("");
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-accent"
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0">
                        <span className="block truncate text-[0.875rem] font-medium">{label}</span>
                        <span className="block truncate text-[0.75rem] text-muted-foreground">{detail}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("alerts.map.categories")}>
          <button
            type="button"
            aria-pressed={serviceLayer === "emergency"}
            onClick={() => setServiceLayer((layer) => (layer === "emergency" ? "all" : "emergency"))}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-semibold shadow-[0_1px_4px_rgb(0_0_0/0.25)] transition-colors",
              serviceLayer === "emergency" ? "bg-error text-error-foreground" : "bg-card text-error hover:bg-error/10",
            )}
          >
            <Ambulance className="size-3.5" aria-hidden />
            {t("alerts.map.emergency")}
          </button>
          <button
            type="button"
            aria-pressed={serviceLayer !== "none"}
            onClick={() => setServiceLayer((layer) => (layer === "none" ? "all" : "none"))}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-medium shadow-[0_1px_4px_rgb(0_0_0/0.25)] transition-colors",
              serviceLayer !== "none" ? "bg-foreground text-background" : "bg-card text-foreground hover:bg-accent",
            )}
          >
            <Building2 className="size-3.5" aria-hidden />
            {t("alerts.map.services")}
          </button>
          {PLACE_KINDS.map((kind) => {
            const Icon = KIND_ICON[kind];
            const active = kinds?.has(kind) ?? false;
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={active}
                onClick={() => toggleKind(kind)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-medium shadow-[0_1px_4px_rgb(0_0_0/0.25)] transition-colors",
                  active ? "bg-foreground text-background" : "bg-card text-foreground hover:bg-accent",
                )}
              >
                <Icon className="size-3.5" style={{ color: active ? undefined : KIND_COLOR[kind] }} aria-hidden />
                {t(`alerts.place.${kind}` as MessageKey)}
              </button>
            );
          })}
        </div>
      </div>

      {/* State of the city and the districts list, top right. */}
      <div className="absolute right-3 top-3 flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={() => setListOpen((open) => !open)}
          aria-expanded={listOpen}
          className="flex items-center gap-2 rounded-full bg-card px-3.5 py-2 text-[0.8125rem] font-semibold text-foreground shadow-[0_2px_6px_rgb(0_0_0/0.28)] hover:bg-accent"
        >
          <span className="size-2.5 rounded-full" style={{ background: alerted.length ? STATUS_COLORS[alerted.sort((a, b) => STATUS_RANK(b.status) - STATUS_RANK(a.status))[0]?.status ?? "SAFE"] : STATUS_COLORS.SAFE }} aria-hidden />
          {alerted.length ? t("alerts.map.zones_count", { count: alerted.length }) : t("alerts.map.all_clear")}
          <List className="size-4 text-muted-foreground" aria-hidden />
        </button>
        {listOpen ? (
          <section className="w-[min(320px,calc(100vw-2rem))] rounded-2xl bg-card p-2 text-foreground shadow-[0_2px_10px_rgb(0_0_0/0.3)]" aria-label={t("alerts.map.select")}>
            <div className="flex flex-wrap gap-1 p-1" role="group" aria-label={t("alerts.map.region_filter")}>
              {[null, ...CITY_REGION_IDS].map((value) => (
                <button
                  key={value ?? "all"}
                  type="button"
                  aria-pressed={region === value}
                  onClick={() => setRegion(value)}
                  className={cn("rounded-full px-2.5 py-1 text-[0.75rem] font-medium", region === value ? "bg-foreground text-background" : "hover:bg-accent")}
                >
                  {value ? t(cityRegionLabelKey(value)) : t("alerts.map.all_regions")}
                </button>
              ))}
            </div>
            <ul className="max-h-[42svh] overflow-y-auto">
              {ordered.map((entry) => (
                <li key={entry.zone}>
                  <button
                    type="button"
                    onClick={() => setSelection({ type: "zone", zone: entry.zone })}
                    className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-accent"
                  >
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: STATUS_COLORS[entry.status] }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[0.875rem] font-medium">
                        {zoneName(entry.zone)}
                        {entry.zone === home ? <Home className="size-3.5 text-foreground" aria-label={t("alerts.map.home_here")} /> : null}
                      </span>
                      <span className="text-[0.75rem] text-muted-foreground">{t(cityRegionLabelKey(entry.region))} · {statusLabel(entry.status)}</span>
                    </span>
                    <span className="text-[0.8125rem] font-semibold tabular-nums text-muted-foreground">{entry.score}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {/* Map controls, bottom right. */}
      <div className="absolute bottom-6 right-3 flex flex-col gap-2">
        {home ? (
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 7e43114 (refactor: replace button title attributes with shadcn/ui tooltips)
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className={cn(control, "rounded-full shadow-[0_1px_4px_rgb(0_0_0/0.3)]")} onClick={() => setSelection({ type: "zone", zone: home })} aria-label={t("alerts.map.home_here")}>
                <LocateFixed className="size-5 text-[#1a73e8]" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("alerts.map.home_here")}</TooltipContent>
          </Tooltip>
<<<<<<< HEAD
=======
          <button type="button" className={cn(control, "rounded-full shadow-[0_1px_4px_rgb(0_0_0/0.3)]")} onClick={() => setSelection({ type: "zone", zone: home })} aria-label={t("alerts.map.home_here")} title={t("alerts.map.home_here")}>
            <LocateFixed className="size-5 text-foreground" aria-hidden />
          </button>
>>>>>>> 0b9a35c (feat: put the landing's island on the city map, ask the district at sign-up, drop emoji, say real error reasons and fix people search)
=======
>>>>>>> 7e43114 (refactor: replace button title attributes with shadcn/ui tooltips)
=======
=======
>>>>>>> 763c828 (feat: put the landing's island on the city map, ask the district at sign-up, drop emoji, say real error reasons and fix people search)
          <button type="button" className={cn(control, "rounded-full shadow-[0_1px_4px_rgb(0_0_0/0.3)]")} onClick={() => setSelection({ type: "zone", zone: home })} aria-label={t("alerts.map.home_here")} title={t("alerts.map.home_here")}>
            <LocateFixed className="size-5 text-foreground" aria-hidden />
          </button>
=======
=======
>>>>>>> c7515a0 (feat: put the landing's island on the city map, ask the district at sign-up, drop emoji, say real error reasons and fix people search)
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className={cn(control, "rounded-full shadow-[0_1px_4px_rgb(0_0_0/0.3)]")} onClick={() => setSelection({ type: "zone", zone: home })} aria-label={t("alerts.map.home_here")}>
                <LocateFixed className="size-5 text-[#1a73e8]" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("alerts.map.home_here")}</TooltipContent>
          </Tooltip>
<<<<<<< HEAD
>>>>>>> 8536026 (refactor: replace button title attributes with shadcn/ui tooltips)
<<<<<<< HEAD
>>>>>>> 9205809 (refactor: replace button title attributes with shadcn/ui tooltips)
=======
=======
=======
          <button type="button" className={cn(control, "rounded-full shadow-[0_1px_4px_rgb(0_0_0/0.3)]")} onClick={() => setSelection({ type: "zone", zone: home })} aria-label={t("alerts.map.home_here")} title={t("alerts.map.home_here")}>
            <LocateFixed className="size-5 text-foreground" aria-hidden />
          </button>
>>>>>>> 0b9a35c (feat: put the landing's island on the city map, ask the district at sign-up, drop emoji, say real error reasons and fix people search)
>>>>>>> c7515a0 (feat: put the landing's island on the city map, ask the district at sign-up, drop emoji, say real error reasons and fix people search)
>>>>>>> 763c828 (feat: put the landing's island on the city map, ask the district at sign-up, drop emoji, say real error reasons and fix people search)
        ) : null}
        {/* Camera controls only exist for the 3D view. */}
        {mode === "3d" ? (
          <>
            <button
              type="button"
              className={cn(control, "rounded-full text-[0.75rem] font-bold shadow-[0_1px_4px_rgb(0_0_0/0.3)]")}
              onClick={() => {
                setFlat((value) => !value);
                sceneRef.current?.setTilt(!flat);
              }}
              aria-pressed={flat}
              aria-label={flat ? "3D" : "2D"}
            >
              {flat ? "3D" : "2D"}
            </button>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className={cn(control, "rounded-full shadow-[0_1px_4px_rgb(0_0_0/0.3)]")} onClick={() => sceneRef.current?.resetNorth()} aria-label={t("alerts.map.north")}>
                  <Compass className="size-5" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("alerts.map.north")}</TooltipContent>
            </Tooltip>
            <div className="flex flex-col overflow-hidden rounded-xl shadow-[0_1px_4px_rgb(0_0_0/0.3)]">
              <button type="button" className={control} onClick={() => sceneRef.current?.zoom(0.7)} aria-label={t("alerts.map.zoom_in")}>
                <Plus className="size-5" aria-hidden />
              </button>
              <span className="h-px bg-border" />
              <button type="button" className={control} onClick={() => sceneRef.current?.zoom(1.4)} aria-label={t("alerts.map.zoom_out")}>
                <Minus className="size-5" aria-hidden />
              </button>
            </div>
          </>
        ) : null}
      </div>

      {serviceLayer === "emergency" && !selection ? (
        <section className="absolute bottom-3 left-3 right-16 max-w-[380px] rounded-2xl bg-card p-4 text-foreground shadow-[0_2px_10px_rgb(0_0_0/0.3)]" aria-label={t("alerts.map.emergency")}>
          <h2 className="flex items-center gap-2 font-semibold text-error">
            <Ambulance className="size-5" aria-hidden />
            {t("alerts.map.emergency_title")}
          </h2>
          <p className="mt-1 text-[0.8125rem] text-muted-foreground">{home ? t("alerts.map.emergency_near", { zone: zoneName(home) }) : t("alerts.map.emergency_body")}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {emergencies.map(({ service }, index) => (
              <li key={service.slug} className={cn("flex items-center gap-3 rounded-xl border px-3 py-2", index === 0 ? "border-error/40 bg-error/10" : "border-border")}>
                <button type="button" onClick={() => setSelection({ type: "service", slug: service.slug })} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[0.875rem] font-semibold">{service.name}</span>
                  <span className="block truncate text-[0.75rem] text-muted-foreground">
                    {index === 0 && home ? `${t("alerts.map.nearest")} · ` : ""}
                    {zoneName(service.zone)}
                    {service.hours ? ` · ${service.hours}` : ""}
                  </span>
                </button>
                {service.phone ? (
                  <a href={`tel:${service.phone.replace(/\s+/g, "")}`} className="flex shrink-0 items-center gap-1 rounded-full bg-error px-3 py-1.5 text-[0.75rem] font-semibold text-error-foreground" aria-label={`${t("alerts.map.call")} ${service.name}`}>
                    <Phone className="size-3.5" aria-hidden />
                    {t("alerts.map.call")}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* What is selected, bottom left. */}
      {selection && zoneEntry ? (
        <div className="absolute bottom-3 left-3 right-16 max-w-[380px]">
          <InfoCard
            selection={selection}
            service={selectedService}
            entry={zoneEntry}
            zoneName={zoneName}
            statusLabel={statusLabel}
            isHome={home === zoneEntry.zone}
            signedIn={signedIn}
            saving={saving}
            onSaveHome={() => void saveHome(zoneEntry.zone)}
            onClose={() => setSelection(null)}
          />
        </div>
      ) : serviceLayer === "emergency" ? null : (
        <p className="pointer-events-none absolute bottom-3 left-3 hidden max-w-[300px] rounded-xl bg-card/90 px-3 py-2 text-[0.75rem] text-foreground shadow-[0_1px_4px_rgb(0_0_0/0.2)] sm:block">
          {t(mode === "3d" ? "alerts.map.hint" : "tn.eco.map_hint_flat")}
        </p>
      )}
    </div>
  );
}

function InfoCard({
  selection,
  service,
  entry,
  zoneName,
  statusLabel,
  isHome,
  signedIn,
  saving,
  onSaveHome,
  onClose,
}: {
  readonly selection: Exclude<Selection, null>;
  readonly service: MapService | undefined;
  readonly entry: ZoneStatusDto;
  readonly zoneName: (zone: CityZoneId) => string;
  readonly statusLabel: (status: ZoneStatusDto["status"]) => string;
  readonly isHome: boolean;
  readonly signedIn: boolean;
  readonly saving: boolean;
  readonly onSaveHome: () => void;
  readonly onClose: () => void;
}) {
  const t = useTranslation();
  const color = STATUS_COLORS[entry.status];
  const place = selection.type === "place" ? CITY_PLACES[selection.index] : undefined;
  const PlaceIcon = place ? KIND_ICON[place.kind] : null;
  return (
    <section className="flex max-h-[52svh] flex-col gap-3 overflow-y-auto rounded-2xl bg-card p-4 text-foreground shadow-[0_2px_10px_rgb(0_0_0/0.3)]" aria-live="polite">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {service ? (
            <>
              <div className="flex items-start gap-2.5">
                <ServiceIcon name={service.icon} className={cn("size-9 rounded-lg", service.emergency && "bg-[#fce8e6] text-error")} />
                <div className="min-w-0">
                  <h2 className="text-[1.0625rem] font-semibold leading-tight">{service.name}</h2>
                  <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
                    {service.category} · {zoneName(service.zone)}
                  </p>
                </div>
              </div>
            </>
          ) : place && PlaceIcon ? (
            <>
              <h2 className="text-[1.125rem] font-semibold leading-tight">{place.name}</h2>
              <p className="mt-0.5 flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground">
                <PlaceIcon className="size-3.5" style={{ color: KIND_COLOR[place.kind] }} aria-hidden />
                {t(`alerts.place.${place.kind}` as MessageKey)} · {zoneName(place.zone)}
              </p>
            </>
          ) : (
            <>
              <p className="text-[0.75rem] uppercase tracking-wide text-muted-foreground">{t(cityRegionLabelKey(entry.region))}</p>
              <h2 className="text-[1.125rem] font-semibold leading-tight">{zoneName(entry.zone)}</h2>
            </>
          )}
        </div>
        <button type="button" onClick={onClose} aria-label={t("common.close")} className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-accent">
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {service ? (
        <div className="flex flex-col gap-1.5 text-[0.8125rem]">
          {service.availability.state !== "AVAILABLE" ? (
            <div className="flex flex-col gap-1">
              <ServiceAvailabilityBadge availability={service.availability} />
              {service.availability.note ? <p className="text-foreground">{service.availability.note}</p> : null}
            </div>
          ) : null}
          {service.hours ? <p><span className="text-muted-foreground">{t("tn.services.hours")} · </span>{service.hours}</p> : null}
          {service.address ? <p><span className="text-muted-foreground">{t("tn.services.address")} · </span>{service.address}</p> : null}
          <div className="mt-1 flex flex-wrap gap-2">
            {service.phone ? (
              <a href={`tel:${service.phone.replace(/\s+/g, "")}`} className={cn("flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[0.8125rem] font-semibold text-error-foreground", service.emergency ? "bg-error" : "bg-[#1a73e8]")}>
                <Phone className="size-4" aria-hidden />
                {t("alerts.map.call")} {service.phone}
              </a>
            ) : null}
            <Link href={`/services/${service.slug}`} className="rounded-full border border-[#dadce0] px-3.5 py-2 text-[0.8125rem] font-medium hover:bg-accent">
              {t("alerts.map.service_page")}
            </Link>
            {!service.emergency ? (
              <Link href={`/contact?service=${encodeURIComponent(service.slug)}`} className="rounded-full border border-[#dadce0] px-3.5 py-2 text-[0.8125rem] font-medium hover:bg-accent">
                {t("tn.services.ask")}
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="rounded-xl px-3 py-2" style={{ background: `${color}1a` }}>
        <p className="flex items-center gap-2 text-[0.875rem] font-semibold" style={{ color }}>
          <span className="size-2 rounded-full" style={{ background: color }} aria-hidden />
          {statusLabel(entry.status)}
          <span className="ml-auto text-[0.75rem] font-medium text-muted-foreground">
            {t("alerts.map.health")} {entry.score}/100
          </span>
        </p>
        <p className="mt-0.5 text-[0.8125rem] text-foreground">{t(`alerts.zone_status_body.${entry.status}` as MessageKey)}</p>
      </div>

      {entry.alerts.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {entry.alerts.map((alert) => (
            <li key={alert.slug}>
              <Link href={`/alerts/${encodeURIComponent(alert.slug)}`} className="block rounded-xl border border-border px-3 py-2 text-[0.8125rem] hover:bg-accent">
                <span className="block font-medium">{alert.title}</span>
                <span className="text-[0.75rem] text-muted-foreground">{t(`alerts.severity.${alert.severity}` as MessageKey)} · {t("alerts.open")}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
        <Users className="size-4" aria-hidden />
        {t("alerts.map.residents", { count: entry.residents })}
      </p>

      {isHome ? (
        <p className="flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-[0.8125rem] font-medium text-[#1967d2]">
          <Home className="size-4" aria-hidden />
          {t("alerts.map.home_here")}
        </p>
      ) : signedIn && selection.type === "zone" ? (
        <Button variant="secondary" size="sm" onClick={onSaveHome} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Home aria-hidden />}
          {t("alerts.map.set_home")}
        </Button>
      ) : null}
    </section>
  );
}

/** The same map, flat, for browsers without WebGL. */
function FlatMap({
  statuses,
  selected,
  home,
  onSelect,
  zoneName,
  services,
  onSelectService,
}: {
  readonly statuses: ReadonlyMap<CityZoneId, ZoneStatusDto>;
  readonly selected: CityZoneId | null;
  readonly home: CityZoneId | null;
  readonly onSelect: (zone: CityZoneId) => void;
  readonly zoneName: (zone: CityZoneId) => string;
  readonly services: readonly MapService[];
  readonly onSelectService: (slug: string) => void;
}) {
  return (
    <svg viewBox="40 60 900 520" className="absolute inset-0 size-full bg-[#a9d3e0]" role="presentation">
      {CITY_ZONES.map((zone) => {
        const points = zone.polygon.map((key) => CITY_ZONE_VERTICES[key]);
        const status = statuses.get(zone.id)?.status ?? "SAFE";
        const cx = points.reduce((sum, point) => sum + point[0], 0) / points.length;
        const cy = points.reduce((sum, point) => sum + point[1], 0) / points.length;
        return (
          <g key={zone.id} onClick={() => onSelect(zone.id)} className="cursor-pointer">
            <polygon
              points={points.map((point) => point.join(",")).join(" ")}
              fill={status === "SAFE" ? "#e8e4da" : STATUS_COLORS[status]}
              fillOpacity={selected === zone.id ? 0.9 : 0.7}
              stroke="#fff"
              strokeWidth={2.5}
            />
            <text x={cx} y={cy} textAnchor="middle" fill="#4b4a45" fontSize={13} fontWeight={600} letterSpacing="0.12em">
              {zoneName(zone.id).toUpperCase()}
              {zone.id === home ? " •" : ""}
            </text>
          </g>
        );
      })}
      {services.map((service) => (
        <g key={service.slug} onClick={() => onSelectService(service.slug)} className="cursor-pointer">
          <title>{service.name}</title>
          <circle cx={service.x} cy={service.y} r={7} fill={service.emergency ? "#d93025" : "#1a73e8"} stroke="#fff" strokeWidth={2} />
        </g>
      ))}
    </svg>
  );
}
