import type { Metadata } from "next";

import { AlertDetailView } from "@/components/alerts/alert-detail-view";
import { NotFoundPanel } from "@/components/feedback/not-found-panel";
import { getAuthContext } from "@/lib/auth/session";
import { NotFoundError } from "@/lib/errors";
import { getCityAlert } from "@/modules/alerts/alerts.service";
import { getOwnProfile } from "@/modules/users/users.service";

export const metadata: Metadata = { title: "Alerte de la ville" };

export default async function CityAlertPage({ params }: { readonly params: Promise<{ slug: string }> }) {
  const [{ slug }, context] = await Promise.all([params, getAuthContext()]);
  const alert = await getCityAlert(slug).catch((error: unknown) => {
    if (error instanceof NotFoundError) return null;
    throw error;
  });
  if (!alert) return <NotFoundPanel backHref="/alerts" />;

  const profile = context ? await getOwnProfile({ user: context.user }) : null;
  return (
    <AlertDetailView
      alert={alert}
      viewerZone={profile?.cityZone ?? null}
      authenticated={Boolean(context)}
    />
  );
}
