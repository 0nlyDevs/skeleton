import type { Metadata } from "next";

import { CityMapView } from "@/components/city-map/city-map-view";
import { getAuthContext } from "@/lib/auth/session";
import { getZoneStatuses, viewerZone } from "@/modules/alerts/alerts.service";

export const metadata: Metadata = { title: "Carte de la cité" };

/** The map of Terra Nova's districts and their live state; public, personalised when signed in. */
export default async function CityMapPage() {
  const context = await getAuthContext();
  const viewer = context?.user ?? null;
  const [statuses, zone] = await Promise.all([getZoneStatuses(), viewerZone(viewer)]);
  return (
    <div className="mx-auto w-full max-w-[1240px]">
      <CityMapView initial={statuses} viewerZone={zone} signedIn={viewer !== null} />
    </div>
  );
}
