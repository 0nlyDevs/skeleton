"use client";

import { Loader2, Radio, UsersRound } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/feedback/empty-state";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FeedCard } from "@/components/social/feed-card";
import { FeedComposer } from "@/components/social/feed-composer";
import { useFeed, type FeedPageResponse } from "@/components/social/use-feed";
import type { FeedItemDto } from "@/modules/posts/posts.dto";
import type { AuthUser } from "@/types";

export function FeedView({
  initial,
  viewer,
  scope = "all",
  authorId,
  followedIds,
  profileHeader,
}: {
  readonly initial: FeedPageResponse;
  readonly viewer: AuthUser | null;
  readonly scope?: "all" | "following";
  readonly authorId?: string;
  readonly followedIds?: readonly string[];
  readonly profileHeader?: React.ReactNode;
}) {
  const t = useTranslation();
  const feed = useFeed({ initial, viewerId: viewer?.id ?? null, scope, authorId, followedIds });
  const addPost = (post: FeedItemDto) => feed.insert(post);

  return (
    <main id="content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-8 sm:py-10">
      {profileHeader}
      {!authorId ? (
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight">{t("feed.title")}</h1><Badge variant="success"><Radio className="size-3" />{t("feed.live")}</Badge></div>
            <p className="text-sm text-muted-foreground">{t("feed.subtitle")}</p>
          </div>
          <nav className="flex gap-1 rounded-lg bg-surface-muted p-1" aria-label={t("feed.title")}>
            <Link href="/feed" aria-current={scope === "all" ? "page" : undefined} className={`rounded-md px-3 py-1.5 text-sm ${scope === "all" ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{t("feed.scope.all")}</Link>
            <Link href="/feed?scope=following" aria-current={scope === "following" ? "page" : undefined} className={`rounded-md px-3 py-1.5 text-sm ${scope === "following" ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{t("feed.scope.following")}</Link>
          </nav>
        </header>
      ) : null}

      {!authorId && viewer ? <FeedComposer user={viewer} onPublished={addPost} /> : null}
      {!authorId && !viewer ? <Card className="flex items-center justify-between gap-3 p-4"><p className="text-sm text-muted-foreground">{t("feed.guest.cta")}</p><Button asChild size="sm"><Link href="/login">{t("auth.login.submit")}</Link></Button></Card> : null}

      {scope === "following" && !viewer ? (
        <EmptyState icon={UsersRound} title={t("feed.following_empty.title")} description={t("feed.following_login")} />
      ) : feed.items.length === 0 ? (
        <EmptyState
          title={scope === "following" ? t("feed.following_empty.title") : t("feed.empty.title")}
          description={scope === "following" ? t("feed.following_empty") : t("feed.empty.body")}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {feed.pendingCount > 0 ? (
            <Button variant="secondary" className="mx-auto" onClick={feed.showPending}>
              {t("feed.new_posts", { count: feed.pendingCount })}
            </Button>
          ) : null}
          {feed.items.map((item) => (
            <FeedCard
              key={item.id}
              item={item}
              signedIn={Boolean(viewer)}
              viewerId={viewer?.id ?? null}
              onReaction={(postId, next) => feed.patch(postId, next)}
            />
          ))}
          {feed.nextCursor ? (
            <Button variant="secondary" disabled={feed.loadingMore} onClick={() => void feed.loadMore()}>
              {feed.loadingMore ? <Loader2 className="animate-spin" /> : null}{t("feed.load_more")}
            </Button>
          ) : <p className="py-3 text-center text-xs text-muted-foreground">{t("feed.end")}</p>}
        </div>
      )}
    </main>
  );
}
