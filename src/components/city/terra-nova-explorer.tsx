"use client";

import { MapPin } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/lib/i18n";
import { CITY_PLACES } from "@/modules/alerts/city-map-data";
import { CITY_ZONES, cityZoneLabelKey, type CityZoneId } from "@/modules/alerts/city-zones";

import { TerraNovaMap, type TerraNovaPoint } from "./terra-nova-map";

/**
 * The city map: Terra Nova's districts and landmarks, all drawn from reference
 * data — no real-world map, no tile server, no external call. Residents can
 * filter by district or search for a landmark.
 */
export function TerraNovaExplorer({ initialZone }: { readonly initialZone?: CityZoneId | null }) {
  const t = useTranslation();
  const [zone, setZone] = useState<CityZoneId | null>(initialZone ?? null);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<TerraNovaPoint | null>(null);

  const term = q.trim().toLocaleLowerCase();
  const places = CITY_PLACES.filter(
    (place) => (!zone || place.zone === zone) && (!term || place.name.toLocaleLowerCase().includes(term)),
  );

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-1 p-5">
        <h1 className="text-[1.375rem] font-bold tracking-tight">{t("map.title")}</h1>
        <p className="text-[0.8438rem] text-muted-foreground">{t("map.subtitle")}</p>
      </Card>

      <div className="grid gap-4 md:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden p-2">
          <TerraNovaMap
            markers={places.map((place) => ({ id: place.name, mapX: place.x, mapY: place.y }))}
            point={selected}
            className="h-[420px] w-full rounded-xl bg-[#a9d3e0] dark:bg-[#16303a]"
            ariaLabel={t("map.title")}
          />
        </Card>

        <div className="flex flex-col gap-3">
          <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder={t("tn.map.picker_search")} aria-label={t("tn.map.picker_search")} maxLength={60} />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("alerts.map.all_regions")}>
            <button
              type="button"
              aria-pressed={zone === null}
              onClick={() => setZone(null)}
              className={cn("rounded-full border px-3 py-1 text-[0.8125rem] font-medium", zone === null ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-surface-muted")}
            >
              {t("tn.map.all_districts")}
            </button>
            {CITY_ZONES.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={zone === item.id}
                onClick={() => setZone(zone === item.id ? null : item.id)}
                className={cn("rounded-full border px-3 py-1 text-[0.8125rem] font-medium", zone === item.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-surface-muted")}
              >
                {t(cityZoneLabelKey(item.id))}
              </button>
            ))}
          </div>
          <ul className="flex max-h-[420px] flex-col gap-1 overflow-y-auto" aria-label={t("tn.map.landmarks")}>
            {places.length === 0 ? (
              <li className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">{t("map.empty")}</li>
            ) : (
              places.map((place) => (
                <li key={place.name}>
                  <button
                    type="button"
                    onClick={() => setSelected({ mapX: place.x, mapY: place.y })}
                    className="flex w-full items-center gap-2 rounded-xl border border-border/70 px-3 py-2 text-left text-[0.8438rem] hover:bg-surface-muted"
                  >
                    <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="block truncate font-medium">{place.name}</span>
                      <span className="block truncate text-[0.75rem] text-muted-foreground">
                        {t(`alerts.place.${place.kind}` as MessageKey)} · {t(cityZoneLabelKey(place.zone))}
                      </span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
