import type { Metadata } from "next";

import { TerraNovaExplorer } from "@/components/city/terra-nova-explorer";
import { CITY_ZONE_IDS, type CityZoneId } from "@/modules/alerts/city-zones";

export const metadata: Metadata = { title: "Carte" };

/** The city map: Terra Nova's districts and landmarks (never a real-world map). */
export default async function MapPage({ searchParams }: { readonly searchParams: Promise<{ zone?: string }> }) {
  const { zone } = await searchParams;
  const initialZone = zone && (CITY_ZONE_IDS as readonly string[]).includes(zone) ? (zone as CityZoneId) : null;
  return (
    <div className="mx-auto w-full max-w-[1000px]">
      <TerraNovaExplorer initialZone={initialZone} />
    </div>
  );
}
