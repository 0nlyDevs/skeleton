import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PostPermalink } from "@/components/social/post-permalink";
import { getAuthContext } from "@/lib/auth/session";
import { getFeedItem } from "@/modules/posts/posts.service";

type PageProps = { readonly params: Promise<{ readonly id: string }> };

export const metadata: Metadata = { title: "Publication" };

/**
 * A post's shareable page (links from notifications, search and "copy link").
 * Same visibility rule as the API: drafts, removed posts and private-group
 * posts are a 404 for anyone who could not open them in the app.
 */
export default async function PostPage({ params }: PageProps) {
  const [{ id }, context] = await Promise.all([params, getAuthContext()]);
  const viewer = context?.user ?? null;
  const post = await getFeedItem(id, viewer).catch(() => null);
  if (!post) notFound();

  return (
    <div className="mx-auto w-full max-w-[680px]">
      <PostPermalink post={post} viewer={viewer ? { id: viewer.id, name: viewer.name, image: viewer.image } : null} />
    </div>
  );
}
