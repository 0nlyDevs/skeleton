"use client";

import { useEffect, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { UserAvatar } from "@/components/shell/user-avatar";
import Link from "@/components/ui/link";
import { apiFetch } from "@/lib/api/client";
import type { FeedItemDto } from "@/modules/posts/posts.dto";

const POST_LINK = /(?:https?:\/\/[^\s/]+)?\/feed\/([A-Za-z0-9_-]{8,64})\b/;

/** The post id a message points at, when it shares a post of this site. */
export function sharedPostId(content: string): string | null {
  const match = POST_LINK.exec(content);
  if (!match?.[1]) return null;
  if (match[0].startsWith("http") && typeof window !== "undefined" && !match[0].startsWith(window.location.origin)) return null;
  return match[1];
}

/** A compact card for a shared post; unavailable posts say so (visibility is the server's). */
export function PostLinkPreview({ postId }: { readonly postId: string }) {
  const t = useTranslation();
  const [post, setPost] = useState<FeedItemDto | null | "gone">(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ data: FeedItemDto }>(`/api/feed/${encodeURIComponent(postId)}`)
      .then((response) => !cancelled && setPost(response.data))
      .catch(() => !cancelled && setPost("gone"));
    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (post === null) return <div className="h-16 w-64 animate-pulse rounded-xl bg-surface-muted" />;
  if (post === "gone") return <p className="rounded-xl border border-dashed border-border px-3 py-2 text-[0.7812rem] text-muted-foreground">{t("share.unavailable")}</p>;

  const image = post.media[0];
  return (
    <Link href={`/feed/${encodeURIComponent(post.id)}`} className="flex w-64 max-w-full overflow-hidden rounded-xl border border-border/70 bg-card text-left hover:bg-surface-muted">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- authorised file route
        <img src={image.url} alt="" className="size-16 shrink-0 object-cover" loading="lazy" />
      ) : null}
      <span className="flex min-w-0 flex-col gap-0.5 px-2.5 py-2">
        <span className="flex items-center gap-1.5 text-[0.75rem] font-semibold">
          <UserAvatar userId={post.author.id} name={post.author.name} image={post.author.image} size="2xs" />
          <span className="truncate">{post.author.name}</span>
        </span>
        <span className="line-clamp-2 text-[0.7812rem] text-muted-foreground">{post.body || post.title}</span>
      </span>
    </Link>
  );
}
