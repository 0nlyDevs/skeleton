import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FeedDetailView } from "@/components/social/feed-detail-view";
import { getAuthContext } from "@/lib/auth/session";
import { getFeedItem } from "@/modules/posts/posts.service";

type PageProps = { readonly params: Promise<{ readonly id: string }> };

export const metadata: Metadata = { title: "Publication", robots: { index: true, follow: true } };

export default async function FeedDetailPage({ params }: PageProps) {
  const [{ id }, context] = await Promise.all([params, getAuthContext()]);
  const post = await getFeedItem(id, context?.user ?? null).catch(() => null);
  if (!post || !post.published || post.deletedAt) notFound();
  return <FeedDetailView post={post} viewer={context?.user ?? null} />;
}
