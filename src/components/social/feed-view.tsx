"use client";

import { ArrowUp, Loader2, Newspaper } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { toast } from "sonner";

import { EmptyState } from "@/components/feedback/empty-state";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { describeApiError } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import type { FeedItemDto } from "@/modules/posts/posts.dto";

import { CommentsDialog } from "./comments-dialog";
import { PostCard } from "./post-card";
import { PostComposer } from "./post-composer";
import { useFeed, type FeedPageResponse, type FeedScope } from "./use-feed";

export interface FeedViewer {
  readonly id: string;
  readonly name: string;
  readonly image: string | null;
}

/**
 * A feed (home, profile or group): optional composer, scope tabs on home,
 * infinite scroll, live "new posts" pill, and comments in a modal so the
 * reader never loses their place.
 */
export function FeedView({
  initial,
  viewer,
  filter = {},
  showTabs = false,
  composer = false,
  composerGroup = null,
  emptyTitle,
  emptyBody,
  previewFooter,
}: {
  readonly initial: FeedPageResponse;
  readonly viewer: FeedViewer | null;
  readonly filter?: FeedScope;
  readonly showTabs?: boolean;
  readonly composer?: boolean;
  readonly composerGroup?: { readonly id: string; readonly name: string } | null;
  readonly emptyTitle?: string;
  readonly emptyBody?: string;
  /** Shown after a group preview (visitor of a public group). */
  readonly previewFooter?: React.ReactNode;
}) {
  const t = useTranslation();
  const [scope, setScope] = useState<"all" | "following" | "for_you">(filter.scope ?? (showTabs && viewer ? "for_you" : "all"));
  const feed = useFeed({ initial, viewerId: viewer?.id ?? null, filter: { ...filter, scope } });
  const [commentsFor, setCommentsFor] = useState<FeedItemDto | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const { loadMore } = feed;

  // Infinite scroll: fetch the next page shortly before the end is visible.
  useEffect(() => {
    const element = sentinel.current;
    if (!element) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    }, { rootMargin: "800px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [loadMore]);

  const current = commentsFor ? (feed.items.find((item) => item.id === commentsFor.id) ?? commentsFor) : null;

  return (
    <div className="flex flex-col gap-4">
      {composer && viewer ? <PostComposer viewer={viewer} group={composerGroup} onPublished={(post) => (scope === "following" && !filter.group ? toast.success(t("feed.posted_elsewhere")) : feed.insert(post))} /> : null}

      {showTabs && viewer ? (
        <div role="tablist" aria-label={t("feed.title")} className="flex gap-1 rounded-2xl bg-card p-1 shadow-panel">
          {(["for_you", "following", "all"] as const).map((value) => (
            <button
              key={value}
              role="tab"
              type="button"
              aria-selected={scope === value}
              onClick={() => setScope(value)}
              className={cn(
                "flex-1 rounded-xl px-3 py-2 text-[13.5px] font-semibold transition-colors",
                scope === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-muted",
              )}
            >
              {value === "for_you" ? t("feed.tab.for_you") : value === "following" ? t("feed.scope.following") : t("feed.tab.recent")}
            </button>
          ))}
        </div>
      ) : null}

      {feed.pending.length > 0 ? (
        <div className="sticky top-20 z-20 flex justify-center">
          <Button size="sm" className="rounded-full shadow-float" onClick={feed.showPending}>
            <ArrowUp />
            {t("feed.new_posts", { count: feed.pending.length })}
          </Button>
        </div>
      ) : null}

      {feed.items.length === 0 && !feed.loadingMore ? (
        <Card>
          <EmptyState
            icon={Newspaper}
            title={emptyTitle ?? (scope === "following" ? t("feed.scope.following") : t("feed.empty.title"))}
            description={emptyBody ?? (scope === "following" ? t("feed.following_empty") : t("feed.empty.body"))}
            className="border-0 bg-transparent"
          />
        </Card>
      ) : null}

      {feed.items.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          viewer={viewer}
          onChange={(post) => (filter.saved && !post.viewerSaved ? feed.remove(post.id) : feed.replace(post))}
          onRemoved={feed.remove}
          onOpenComments={setCommentsFor}
          onShared={(post) => (scope === "following" && !filter.group ? undefined : feed.insert(post))}
        />
      ))}

      <div ref={sentinel} aria-hidden />
      {feed.loadingMore ? (
        <div className="flex justify-center py-4">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : feed.loadError ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <p className="text-[13px] text-muted-foreground">{describeApiError(feed.loadError, t)}</p>
          <Button size="sm" variant="secondary" onClick={() => void feed.loadMore()}>
            {t("common.retry")}
          </Button>
        </div>
      ) : initial.preview ? (
        previewFooter ?? null
      ) : feed.items.length > 0 && !feed.nextCursor ? (
        <p className="py-4 text-center text-[12.5px] text-muted-foreground">{t("feed.end")}</p>
      ) : null}

      <CommentsDialog
        post={current}
        viewer={viewer}
        canComment={current?.viewerCanInteract ?? false}
        onOpenChange={(open) => !open && setCommentsFor(null)}
      />
    </div>
  );
}
