import type { Metadata } from "next";

import { FeedView } from "@/components/social/feed-view";
import { requirePageAuth } from "@/lib/auth/page-guards";
import { getServerDictionary } from "@/lib/i18n/server";
import { listSavedPosts } from "@/modules/bookmarks/bookmarks.service";

export const metadata: Metadata = { title: "Enregistrements" };

/** The viewer's saved posts, newest save first. Private to the viewer. */
export default async function SavedPage() {
  const { user } = await requirePageAuth("/saved");
  const { t } = await getServerDictionary();
  const initial = await listSavedPosts(user, { limit: 10 });

  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-4">
      <header className="px-1">
        <h1 className="text-xl font-semibold tracking-tight">{t("saved.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("saved.subtitle")}</p>
      </header>
      <FeedView
        initial={initial}
        viewer={{ id: user.id, name: user.name, image: user.image }}
        filter={{ saved: true }}
        emptyTitle={t("saved.empty_title")}
        emptyBody={t("saved.empty_body")}
      />
    </div>
  );
}
