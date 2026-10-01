import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FeedView } from "@/components/social/feed-view";
import { PublicProfileHeader } from "@/components/social/public-profile-header";
import { getAuthContext } from "@/lib/auth/session";
import { getPublicProfile } from "@/modules/follows/follows.service";
import { listFeed } from "@/modules/posts/posts.service";

type PageProps = { readonly params: Promise<{ readonly username: string }> };

export const metadata: Metadata = { title: "Public profile", robots: { index: true, follow: true } };

export default async function PublicProfilePage({ params }: PageProps) {
  const [{ username }, context] = await Promise.all([params, getAuthContext()]);
  const viewer = context?.user ?? null;
  const profile = await getPublicProfile(username, viewer).catch(() => null);
  if (!profile) notFound();
  const initial = await listFeed({ authorId: profile.id, limit: 10, scope: "all" }, viewer);
  return (
    <FeedView
      initial={initial}
      viewer={viewer}
      authorId={profile.id}
      profileHeader={<PublicProfileHeader profile={profile} viewer={viewer} />}
    />
  );
}
