import type { Metadata } from "next";

import { FeedView } from "@/components/social/feed-view";
import { getAuthContext } from "@/lib/auth/session";
import { listFeed } from "@/modules/posts/posts.service";

export const metadata: Metadata = { title: "Fil d'actualité" };

/** Home: composer, For you / Following, live feed. Guests read the public feed. */
export default async function FeedPage() {
  const context = await getAuthContext();
  const viewer = context?.user ?? null;
  const initial = await listFeed({ limit: 10, scope: "all" }, viewer);

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
