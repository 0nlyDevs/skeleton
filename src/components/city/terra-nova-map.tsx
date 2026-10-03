"use client";

import type { MouseEvent } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { CITY_ZONES, CITY_ZONE_VERTICES, cityZoneLabelKey, zoneAt, type CityZoneId } from "@/modules/alerts/city-zones";

/** The city plane (1000 × 640) framed a little inside its land mass. */
const VIEW = { x: 60, y: 70, width: 880, height: 500 } as const;

export interface TerraNovaPoint {
  readonly mapX: number;
  readonly mapY: number;
}

/** Turn a click inside the SVG into a point of the Terra Nova plane, or null off the city. */
function pointFromEvent(event: MouseEvent<SVGSVGElement>): TerraNovaPoint | null {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = Math.round(VIEW.x + ((event.clientX - rect.left) / rect.width) * VIEW.width);
  const y = Math.round(VIEW.y + ((event.clientY - rect.top) / rect.height) * VIEW.height);
  return zoneAt(x, y) ? { mapX: x, mapY: y } : null;
}

/**
 * The one city map: Terra Nova's districts and points, drawn from the reference
 * data in `city-zones` so no real-world map or tile server is ever involved.
 * Interactive when `onPick` is given (used by the Terra Nova picker).
 */
export function TerraNovaMap({
  point,
  markers = [],
  onPick,
  className,
  ariaLabel,
}: {
  readonly point?: TerraNovaPoint | null;
  readonly markers?: readonly (TerraNovaPoint & { readonly id: string })[];
  readonly onPick?: (point: TerraNovaPoint) => void;
  readonly className?: string;
  readonly ariaLabel?: string;
}) {
  const t = useTranslation();
  const zone: CityZoneId | null = point ? zoneAt(point.mapX, point.mapY) : null;

  return (
    <svg
      viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.width} ${VIEW.height}`}
      onClick={onPick ? (event) => { const picked = pointFromEvent(event); if (picked) onPick(picked); } : undefined}
      className={`${onPick ? "cursor-crosshair " : ""}${className ?? "w-full rounded-xl bg-[#a9d3e0] dark:bg-[#16303a]"}`}
      role="img"
      aria-label={ariaLabel ?? t("alerts.map.title")}
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
      {markers.map((marker) => (
        <circle key={marker.id} cx={marker.mapX} cy={marker.mapY} r={9} fill="#1a73e8" stroke="#fff" strokeWidth={3} />
      ))}
      {point ? <circle cx={point.mapX} cy={point.mapY} r={11} fill="#1a73e8" stroke="#fff" strokeWidth={4} /> : null}
    </svg>
  );
}
