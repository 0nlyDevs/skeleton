"use client";

import Link from "@/components/ui/link";
import { useEffect, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { useFormatters } from "@/hooks/use-formatters";
import { UserAvatar } from "@/components/shell/user-avatar";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";
import type { FeedItemDto } from "@/modules/posts/posts.dto";

/** Nearest neighbours of a post in embedding space ("Publications similaires"). */
export function SimilarPosts({ postId }: { readonly postId: string }) {
  const t = useTranslation();
  const fmt = useFormatters();
  const [posts, setPosts] = useState<FeedItemDto[]>([]);
  useEffect(() => {
    let cancelled = false;
    void apiFetch<{ data: FeedItemDto[] }>(`/api/posts/${encodeURIComponent(postId)}/similar`)
      .then((response) => !cancelled && setPosts(response.data))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (posts.length === 0) return null;
  return (
    <Card className="p-4">
      <h2 className="mb-2 text-[15px] font-semibold">{t("feed.similar")}</h2>
      <ul className="flex flex-col divide-y divide-border/60">
        {posts.map((post) => (
          <li key={post.id}>
            <Link href={`/feed/${post.id}`} className="flex items-start gap-3 py-2.5 hover:opacity-90">
              <UserAvatar userId={post.author.id} name={post.author.name} image={post.author.image} size="xs" />
              <span className="min-w-0">
                <span className="block text-[12.5px] text-muted-foreground">
                  {post.author.name} · {fmt.relative(post.createdAt)}
                </span>
                <span className="line-clamp-2 text-[14px]">{post.body || post.title}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
