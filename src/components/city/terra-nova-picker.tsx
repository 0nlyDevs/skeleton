"use client";

import { MapPin, Search } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CITY_PLACES } from "@/modules/alerts/city-map-data";
import { cityZoneLabelKey, zoneAt } from "@/modules/alerts/city-zones";

import { TerraNovaMap, type TerraNovaPoint } from "./terra-nova-map";

/** A place chosen on the Terra Nova map: a landmark or a free point in a district. */
export interface PickedPoint extends TerraNovaPoint {
  readonly name: string;
}

/**
 * Choose where something is in Terra Nova: pick a landmark from the city map or
 * tap a point in a district. There is no real-world map and no network call —
 * the districts come from the reference data the rest of the city uses.
 */
export function TerraNovaPicker({
  open,
  onOpenChange,
  onPick,
  title,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onPick: (point: PickedPoint) => void;
  readonly title?: string;
}) {
  const t = useTranslation();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<PickedPoint | null>(null);

  const term = q.trim().toLocaleLowerCase();
  const landmarks = term ? CITY_PLACES.filter((place) => place.name.toLocaleLowerCase().includes(term)) : CITY_PLACES;

  const pickPoint = (point: TerraNovaPoint) => {
    const zone = zoneAt(point.mapX, point.mapY);
    if (!zone) return;
    setSelected({ ...point, name: t(cityZoneLabelKey(zone)) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title ?? t("place.title")}</DialogTitle>
          <DialogDescription>{t("tn.map.picker_hint")}</DialogDescription>
        </DialogHeader>
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder={t("tn.map.picker_search")}
            aria-label={t("tn.map.picker_search")}
            className="pl-9"
            maxLength={60}
          />
        </label>
        <div className="h-52 overflow-hidden rounded-xl">
          <TerraNovaMap point={selected} onPick={pickPoint} />
        </div>
        {landmarks.length > 0 ? (
          <ul className="max-h-40 overflow-y-auto rounded-xl border border-border/70" aria-label={t("tn.map.landmarks")}>
            {landmarks.map((place) => (
              <li key={place.name}>
                <button
                  type="button"
                  onClick={() => setSelected({ name: place.name, mapX: place.x, mapY: place.y })}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[0.8438rem] hover:bg-surface-muted"
                >
                  <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate">{place.name}</span>
                  <span className="ml-auto truncate text-[0.75rem] text-muted-foreground">{t(cityZoneLabelKey(place.zone))}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[0.8125rem] text-muted-foreground">{t("tn.map.no_landmark")}</p>
        )}
        <DialogFooter className="items-center sm:justify-between">
          <span className="truncate text-[0.8125rem] text-muted-foreground">{selected?.name}</span>
          <Button
            disabled={!selected}
            onClick={() => {
              if (selected) onPick(selected);
              onOpenChange(false);
            }}
          >
            {t("place.choose")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
