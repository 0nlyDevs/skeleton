"use client";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { FeedItemDto } from "@/modules/posts/posts.dto";

import { CommentThread, type ThreadViewer } from "./comment-thread";
import { MediaGrid } from "./media-grid";
import { RichText } from "./rich-text";

/**
 * Comments in place: the post stays in context at the top, the thread scrolls,
 * the composer is pinned to the bottom, and closing returns to the exact
 * scroll position in the feed (nothing navigated away).
 */
export function CommentsDialog({
  post,
  viewer,
  canComment,
  onOpenChange,
}: {
  readonly post: FeedItemDto | null;
  readonly viewer: ThreadViewer | null;
  readonly canComment: boolean;
  readonly onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslation();
  return (
    <Dialog open={post !== null} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(88dvh,760px)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        {post ? (
          <>
            <DialogHeader className="shrink-0 border-b border-border/60 px-4 py-3 text-left">
              <DialogTitle className="text-[0.9375rem]">{t("comments.title")} · {post.author.name}</DialogTitle>
              <DialogDescription className="sr-only">{t("comments.title")}</DialogDescription>
            </DialogHeader>
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="max-h-[35%] shrink-0 overflow-y-auto border-b border-border/60 px-4 py-3">
                {post.body ? (
                  <RichText text={post.body} mentions={post.mentions} className="whitespace-pre-line break-words text-[0.875rem] leading-relaxed text-foreground/90" />
                ) : null}
                {post.media.length > 0 ? (
                  <div className="mt-2 max-w-sm">
                    <MediaGrid media={post.media} />
                  </div>
                ) : null}
              </div>
              <CommentThread
                postId={post.id}
                viewer={viewer}
                canComment={canComment}
                canModerate={post.viewerCanModerate}
                className="min-h-0 flex-1"
                autoFocus
              />
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
