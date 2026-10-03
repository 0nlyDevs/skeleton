"use client";

import { MapPin, X } from "lucide-react";
import type { MouseEvent } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { CITY_ZONES, CITY_ZONE_VERTICES, cityZoneLabelKey, zoneAt } from "@/modules/alerts/city-zones";

const VIEW = { x: 60, y: 70, width: 880, height: 500 } as const;

/**
 * Admins place a service's premises by clicking the city map. The district
 * shown here is a preview; the server derives it again from the position.
 */
export function MapPositionPicker({
  value,
  emergency,
  onChange,
}: {
  readonly value: { readonly x: number; readonly y: number } | null;
  readonly emergency: boolean;
  readonly onChange: (value: { x: number; y: number } | null) => void;
}) {
  const t = useTranslation();
  const zone = value ? zoneAt(value.x, value.y) : null;

  const pick = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.round(VIEW.x + ((event.clientX - rect.left) / rect.width) * VIEW.width);
    const y = Math.round(VIEW.y + ((event.clientY - rect.top) / rect.height) * VIEW.height);
    if (zoneAt(x, y)) onChange({ x, y });
  };

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.width} ${VIEW.height}`}
        onClick={pick}
        className="w-full cursor-crosshair rounded-xl bg-[#a9d3e0] dark:bg-[#16303a]"
        role="img"
        aria-label={t("tn.agent.services.form.location_hint")}
      >
        {CITY_ZONES.map((item) => (
          <polygon
            key={item.id}
            points={item.polygon.map((key) => CITY_ZONE_VERTICES[key].join(",")).join(" ")}
            fill={item.id === zone ? "#ece4d2" : "#d8d2c3"}
            stroke="#fff"
            strokeWidth={3}
          >
            <title>{t(cityZoneLabelKey(item.id))}</title>
          </polygon>
        ))}
        {value ? <circle cx={value.x} cy={value.y} r={11} fill={emergency ? "#d93025" : "#1a73e8"} stroke="#fff" strokeWidth={4} /> : null}
      </svg>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[0.8125rem]">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="size-4" aria-hidden />
          {zone ? t(cityZoneLabelKey(zone)) : t("tn.agent.services.form.location_none")}
        </span>
        {value ? (
          <button type="button" onClick={() => onChange(null)} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <X className="size-3.5" aria-hidden />
            {t("tn.agent.services.form.location_clear")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
