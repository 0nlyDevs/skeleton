import type { Metadata } from "next";

import { FeedView } from "@/components/social/feed-view";
import { getAuthContext } from "@/lib/auth/session";
import { listFeed } from "@/modules/posts/posts.service";
import { getFollowingIds } from "@/modules/follows/follows.service";

type PageProps = { readonly searchParams: Promise<{ readonly scope?: string }> };

export const metadata: Metadata = { title: "Feed", robots: { index: true, follow: true } };

export default async function FeedPage({ searchParams }: PageProps) {
  const [{ scope: requestedScope }, context] = await Promise.all([searchParams, getAuthContext()]);
  const scope = requestedScope === "following" ? "following" : "all";
  const viewer = context?.user ?? null;
  const followingIds = scope === "following" && viewer ? await getFollowingIds(viewer.id) : undefined;
  const initial = scope === "following" && !viewer
    ? { data: [], nextCursor: null }
    : await listFeed({ limit: 10, scope }, viewer, followingIds);

  return <FeedView initial={initial} viewer={viewer} scope={scope} followedIds={followingIds} />;
}
