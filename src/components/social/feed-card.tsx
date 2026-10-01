"use client";

import { MessageCircle } from "lucide-react";
import Link from "next/link";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FeedItemDto } from "@/modules/posts/posts.dto";

import { ReportContentButton } from "./report-content-button";
import { ReactionBar, type ReactionState } from "./reaction-bar";
import { UserChip } from "./user-chip";

/** One post in the feed. The body is clamped; the title links to the thread. */
export function FeedCard({
  item,
  signedIn,
  viewerId = null,
  onReaction,
  expanded = false,
}: {
  readonly item: FeedItemDto;
  readonly signedIn: boolean;
  readonly viewerId?: string | null;
  readonly onReaction: (postId: string, next: ReactionState) => void;
  readonly expanded?: boolean;
}) {
  const t = useTranslation();
  const href = `/feed/${encodeURIComponent(item.id)}`;
  const edited = item.updatedAt !== item.createdAt && Date.parse(item.updatedAt) - Date.parse(item.createdAt) > 60_000;

  return (
    <Card className="flex flex-col gap-3 p-4 sm:p-5">
      <UserChip
        user={item.author}
        meta={
          <time dateTime={item.createdAt}>
            {formatRelative(item.createdAt)}
            {edited ? ` · ${t("feed.edited")}` : ""}
          </time>
        }
      />

      <div className="flex flex-col gap-1.5">
        {expanded ? (
          <h1 className="text-[20px] font-semibold leading-snug tracking-[-0.01em]">{item.title}</h1>
        ) : (
          <Link href={href} className="text-[16px] font-semibold leading-snug hover:underline">
            {item.title}
          </Link>
        )}
        {/* Rendered as text: user content is never interpreted as markup. */}
        <p
          className={cn(
            "whitespace-pre-line break-words text-[14px] leading-relaxed text-foreground/90",
            !expanded && "line-clamp-6",
          )}
        >
          {item.body}
        </p>
        {item.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {item.tags.map((tag) => (
              <Badge key={tag} variant="neutral">
                #{tag}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
        <ReactionBar
          postId={item.id}
          signedIn={signedIn}
          state={{ reactions: item.reactions, reactionCount: item.reactionCount, viewerReaction: item.viewerReaction }}
          onChange={(next) => onReaction(item.id, next)}
        />
        {expanded ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
              <MessageCircle className="size-4" />
              {t("feed.comments_count", { count: item.commentCount })}
            </span>
            {item.author.id !== viewerId ? <ReportContentButton targetType="post" targetId={item.id} signedIn={signedIn} label={t("feed.report")} compact /> : null}
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Link
              href={`${href}#comments`}
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[12.5px] text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            >
              <MessageCircle className="size-4" />
              {t("feed.comments_count", { count: item.commentCount })}
            </Link>
            {item.author.id !== viewerId ? <ReportContentButton targetType="post" targetId={item.id} signedIn={signedIn} label={t("feed.report")} compact /> : null}
          </div>
        )}
      </div>
    </Card>
  );
}
