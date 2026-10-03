import type { Metadata } from "next";

import { FeedView } from "@/components/social/feed-view";
import { AlertFeedHighlights } from "@/components/alerts/alert-feed-highlights";
import { getAuthContext } from "@/lib/auth/session";
import { listCityAlerts, viewerZone } from "@/modules/alerts/alerts.service";
import { listFeed } from "@/modules/posts/posts.service";
import { rankForYou } from "@/modules/recommendations/recommendations.service";

export const metadata: Metadata = { title: "Fil d'actualité" };

/** Home: composer, For you / Following, live feed. Guests read the public feed. */
export default async function FeedPage() {
  const context = await getAuthContext();
  const viewer = context?.user ?? null;
  // Members land on "Pour vous" (KNN-ranked); guests on the newest posts.
  const [initial, alerts, zone] = await Promise.all([
    viewer ? rankForYou(viewer, 0, 10) : listFeed({ limit: 10, scope: "all" }, null),
    listCityAlerts({ limit: 10 }),
    viewerZone(viewer),
  ]);

  return (
    <div className="mx-auto w-full max-w-[680px]">
      <div className="mb-4 empty:hidden">
        <AlertFeedHighlights initial={alerts.data} viewerZone={zone} />
      </div>
      <FeedView
        initial={initial}
        viewer={viewer ? { id: viewer.id, name: viewer.name, image: viewer.image } : null}
        composer
        showTabs
      />
    </div>
  );
}
