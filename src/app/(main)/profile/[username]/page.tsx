import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FeedView } from "@/components/social/feed-view";
import { ProfileHeader } from "@/components/social/profile-header";
import { getAuthContext } from "@/lib/auth/session";
import { getPublicProfile } from "@/modules/follows/follows.service";
import { listFeed } from "@/modules/posts/posts.service";

type PageProps = { readonly params: Promise<{ readonly username: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}` };
}

/** Public profile: identity, counters, social actions, then the timeline. */
export default async function ProfilePage({ params }: PageProps) {
  const [{ username }, context] = await Promise.all([params, getAuthContext()]);
  const viewer = context?.user ?? null;
  const profile = await getPublicProfile(decodeURIComponent(username), viewer).catch(() => null);
  if (!profile) notFound();

  const initial = await listFeed({ authorId: profile.id, limit: 10, scope: "all" }, viewer);

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4">
      <ProfileHeader profile={profile} signedIn={viewer !== null} />
      <FeedView
        initial={initial}
        viewer={viewer ? { id: viewer.id, name: viewer.name, image: viewer.image } : null}
        filter={{ authorId: profile.id }}
        composer={profile.isSelf}
      />
    </div>
  );
}
