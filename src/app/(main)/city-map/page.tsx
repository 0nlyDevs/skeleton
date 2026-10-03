import type { Metadata } from "next";

import { CityMapView, type MapService } from "@/components/city-map/city-map-view";
import { getAuthContext } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/server";
import { getZoneStatuses, viewerZone } from "@/modules/alerts/alerts.service";
import { listServices } from "@/modules/city-services/city-services.service";

export const metadata: Metadata = { title: "Carte de la cité" };

/**
 * The city map: districts and their live state, landmarks, the resident's
 * home, and every service that receives people (emergency first). Public;
 * `?service=<slug>` opens one service, `?layer=emergency` the emergency view.
 */
export default async function CityMapPage({ searchParams }: { readonly searchParams: Promise<{ service?: string; layer?: string }> }) {
  const context = await getAuthContext();
  const viewer = context?.user ?? null;
  const locale = await getLocale();
  const [statuses, zone, catalogue, params] = await Promise.all([getZoneStatuses(), viewerZone(viewer), listServices({}, viewer, locale), searchParams]);
  const services: MapService[] = catalogue.flatMap((service) =>
    service.location
      ? [{
          slug: service.slug,
          name: service.name,
          category: service.category,
          icon: service.icon,
          emergency: service.emergency,
          hours: service.hours,
          phone: service.phone,
          address: service.address,
          x: service.location.x,
          y: service.location.y,
          zone: service.location.zone,
        }]
      : [],
  );
  const focus = {
    ...(params.service && services.some((service) => service.slug === params.service) ? { service: params.service } : {}),
    ...(params.layer === "emergency" ? { layer: "emergency" as const } : {}),
  };
  return (
    <div className="mx-auto w-full max-w-[1240px]">
      <CityMapView initial={statuses} viewerZone={zone} signedIn={viewer !== null} services={services} focus={focus} />
    </div>
  );
}
