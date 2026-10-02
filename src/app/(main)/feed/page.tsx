import type { Metadata } from "next";

import { FeedView } from "@/components/social/feed-view";
import { getAuthContext } from "@/lib/auth/session";
import { listFeed } from "@/modules/posts/posts.service";
import { rankForYou } from "@/modules/recommendations/recommendations.service";

export const metadata: Metadata = { title: "Fil d'actualité" };

/** Home: composer, For you / Following, live feed. Guests read the public feed. */
export default async function FeedPage() {
  const context = await getAuthContext();
  const viewer = context?.user ?? null;
  // Members land on "Pour vous" (KNN-ranked); guests on the newest posts.
  const initial = viewer ? await rankForYou(viewer, 0, 10) : await listFeed({ limit: 10, scope: "all" }, null);

  return (
    <div className="mx-auto w-full max-w-[680px]">
      <FeedView
        initial={initial}
        viewer={viewer ? { id: viewer.id, name: viewer.name, image: viewer.image } : null}
        composer
        showTabs
      />
    </div>
  );
}
