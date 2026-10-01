"use client";

import Link from "next/link";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { FeedCard } from "@/components/social/feed-card";
import { CommentThread } from "@/components/social/comment-thread";
import { useFeed } from "@/components/social/use-feed";
import type { FeedItemDto } from "@/modules/posts/posts.dto";
import type { AuthUser } from "@/types";

export function FeedDetailView({ post, viewer }: { readonly post: FeedItemDto; readonly viewer: AuthUser | null }) {
  const t = useTranslation();
  const feed = useFeed({ initial: { data: [post], nextCursor: null }, viewerId: viewer?.id ?? null });
  const current = feed.items.find((item) => item.id === post.id) ?? post;

  return (
    <main id="content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-8 sm:py-10">
      <Button asChild variant="ghost" className="self-start px-2">
        <Link href="/feed">← {t("feed.back")}</Link>
      </Button>
      <FeedCard item={current} signedIn={Boolean(viewer)} viewerId={viewer?.id ?? null} expanded onReaction={(postId, next) => feed.patch(postId, next)} />
      <CommentThread postId={current.id} viewer={viewer} initialCount={current.commentCount} />
    </main>
  );
}
