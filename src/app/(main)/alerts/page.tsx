import type { Metadata } from "next";

import { CityAlertsView } from "@/components/alerts/city-alerts-view";
import { getAuthContext } from "@/lib/auth/session";
import { isStaff } from "@/lib/auth/guards";
import { getOwnProfile } from "@/modules/users/users.service";
import { listCityAlerts } from "@/modules/alerts/alerts.service";

export const metadata: Metadata = { title: "Alertes de la ville" };

export default async function CityAlertsPage() {
  const context = await getAuthContext();
  const [result, profile] = await Promise.all([
    listCityAlerts({ limit: 40 }),
    context ? getOwnProfile({ user: context.user }) : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto w-full max-w-[820px]">
      <CityAlertsView
        initial={result.data}
        isStaff={Boolean(context && isStaff(context.user))}
        viewerZone={profile?.cityZone ?? null}
      />
    </div>
  );
}
