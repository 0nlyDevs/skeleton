import { Map as MapIcon, MapPin } from "lucide-react";

import Link from "@/components/ui/link";
import { CITY_ZONES, CITY_ZONE_VERTICES, type CityZoneId } from "@/modules/alerts/city-zones";

/**
 * "Where to find us": the service's spot on a small city map, its district
 * and address, and a link that opens the full map on it.
 */
export function ServiceLocationCard({
  slug,
  location,
  address,
  emergency,
  labels,
}: {
  readonly slug: string;
  readonly location: { readonly x: number; readonly y: number; readonly zone: CityZoneId };
  readonly address: string | null;
  readonly emergency: boolean;
  readonly labels: { readonly title: string; readonly zone: string; readonly openMap: string };
}) {
  const pin = emergency ? "#d93025" : "#1a73e8";
  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card" aria-labelledby="where">
      <svg viewBox="60 70 880 500" className="block w-full bg-[#a9d3e0] dark:bg-[#16303a]" role="img" aria-label={`${labels.title}, ${labels.zone}`}>
        {CITY_ZONES.map((zone) => (
          <polygon
            key={zone.id}
            points={zone.polygon.map((key) => CITY_ZONE_VERTICES[key].join(",")).join(" ")}
            fill={zone.id === location.zone ? "#e9e1cf" : "#d8d2c3"}
            stroke="#fff"
            strokeWidth={3}
          />
        ))}
        <circle cx={location.x} cy={location.y} r={26} fill={pin} opacity={0.18} />
        <circle cx={location.x} cy={location.y} r={11} fill={pin} stroke="#fff" strokeWidth={4} />
      </svg>
      <div className="flex flex-col gap-2 p-4">
        <h2 id="where" className="font-semibold">{labels.title}</h2>
        <p className="flex items-start gap-2 text-sm">
          <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            <span className="font-medium">{labels.zone}</span>
            {address ? <span className="block text-muted-foreground">{address}</span> : null}
          </span>
        </p>
        <Link href={`/city-map?service=${encodeURIComponent(slug)}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <MapIcon className="size-4" aria-hidden />
          {labels.openMap}
        </Link>
      </div>
    </section>
  );
}
