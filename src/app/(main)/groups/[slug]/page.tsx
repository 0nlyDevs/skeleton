import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { getServerDictionary } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GroupView } from "@/components/groups/group-view";
import { getAuthContext } from "@/lib/auth/session";
import { getGroup } from "@/modules/groups/groups.service";
import { listFeed } from "@/modules/posts/posts.service";

type PageProps = {
  readonly params: Promise<{ readonly slug: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = { title: "Groupe" };

/**
 * A group: anyone sees its card; its posts and members only when the viewer
 * may read them (public group, or active member of a private one).
 */
export default async function GroupPage({ params, searchParams }: PageProps) {
  const [{ slug }, query, context] = await Promise.all([params, searchParams, getAuthContext()]);
  const viewer = context?.user ?? null;
  const group = await getGroup(slug, viewer).catch(() => null);
  if (!group) notFound();
  const { t } = await getServerDictionary();

  const feed = group.viewer.canRead ? await listFeed({ groupSlug: slug, limit: 10, scope: "all" }, viewer) : null;
  const tab = query.tab === "members" || query.status === "PENDING" ? "members" : "discussion";

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4">
      <Breadcrumbs label={t("tn.breadcrumb.label")} items={[{ label: t("tn.place.community"), href: "/feed" }, { label: t("nav.groups"), href: "/groups" }, { label: group.name }]} />
      <GroupView
        group={group}
        initialFeed={feed}
        initialTab={tab}
        viewer={viewer ? { id: viewer.id, name: viewer.name, image: viewer.image, isPlatformAdmin: viewer.role === "ADMIN" } : null}
      />
    </div>
  );
}
