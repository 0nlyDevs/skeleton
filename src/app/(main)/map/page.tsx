import type { Metadata } from "next";

import { MapExplorer } from "@/components/maps/map-explorer";

export const metadata: Metadata = { title: "Carte" };

function coordinate(value: string | string[] | undefined, min: number, max: number): number | null {
  const number = typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

/** Public map of geotagged posts (visibility is applied by the API). */
export default async function MapPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const latitude = coordinate(params.lat, -90, 90);
  const longitude = coordinate(params.lng, -180, 180);
  // Default view: Indian Ocean (Webcup islands); a post's pin when linked.
  const initial =
    latitude !== null && longitude !== null ? { latitude, longitude, zoom: 15 } : { latitude: -19.5, longitude: 52, zoom: 5 };
  return (
    <div className="mx-auto w-full max-w-[1000px]">
      <MapExplorer initial={initial} initialFromLink={latitude !== null && longitude !== null} />
    </div>
  );
}
