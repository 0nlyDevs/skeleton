"use client";

import { Bookmark, BookmarkCheck, Flag, Globe, Link2, MapPin, Lock, MessageCircle, MoreHorizontal, Pencil, Repeat2, Share2, ShieldAlert, SquarePen, Trash2, UsersRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useTranslation } from "@/components/providers/i18n-provider";
import { UserAvatar } from "@/components/shell/user-avatar";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FeedItemDto } from "@/modules/posts/posts.dto";

import { MediaGrid } from "./media-grid";
import { PollView } from "./poll-view";
import { PostEditDialog } from "./post-edit-dialog";
import { ReactionButton, ReactionSummary } from "./reaction-picker";
import { ReportDialog } from "./report-dialog";
import { RepostEmbed } from "./repost-embed";
import { RichText } from "./rich-text";
import { ShareDialog, sharePost } from "./share-dialog";

const CLAMP_CHARS = 420;

export interface PostCardViewer {
  readonly id: string;
}

/** A post as the feed shows it. Every action re-checks rights server-side. */
export function PostCard({
  post,
  viewer,
  onChange,
  onRemoved,
  onOpenComments,
  onShared,
  expanded = false,
}: {
  readonly post: FeedItemDto;
  readonly viewer: PostCardViewer | null;
  readonly onChange: (post: FeedItemDto) => void;
  readonly onRemoved: (postId: string) => void;
  readonly onOpenComments?: (post: FeedItemDto) => void;
  readonly onShared?: (post: FeedItemDto) => void;
  readonly expanded?: boolean;
}) {
  const t = useTranslation();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAll, setShowAll] = useState(expanded);
  const [sharing, setSharing] = useState(false);

  // What a share points at: the original of a share, else this post. Only
  // content public to everyone can be re-shared (the server enforces it too).
  const shareTarget = post.repostOf
    ? post.repostOf.available
      ? post.repostOf
      : null
    : post.published && (post.group === null || post.group.privacy === "PUBLIC")
      ? {
          id: post.id,
          available: true,
          body: post.body,
          author: post.author,
          media: post.media,
          mentions: post.mentions,
          group: post.group,
          createdAt: post.createdAt,
        }
      : null;

  const shareNow = async () => {
    if (!shareTarget) return;
    try {
      const shared = await sharePost(shareTarget.id);
      toast.success(t("share.done"));
      onShared?.(shared);
    } catch (error) {
      toast.error(describeApiError(error, t));
    }
  };

  // Clicking the post's content opens it (with its comments) in place; links,
  // buttons and images keep their own behaviour.
  const openFromContent = (event: React.MouseEvent) => {
    if (expanded || !onOpenComments) return;
    if ((event.target as HTMLElement).closest("a,button,[role=button]")) return;
    if (window.getSelection()?.toString()) return;
    onOpenComments(post);
  };

  const isAuthor = viewer?.id === post.author.id;
  const canRemove = isAuthor || post.viewerCanModerate;
  const long = post.body.length > CLAMP_CHARS;
  const href = `/feed/${encodeURIComponent(post.id)}`;

  const remove = async () => {
    setDeleting(true);
    try {
      await apiFetch(`/api/posts/${encodeURIComponent(post.id)}`, { method: "DELETE" });
      toast.success(t("post.deleted"));
      setConfirm(false);
      onRemoved(post.id);
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setDeleting(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${href}`);
      toast.success(t("post.link_copied"));
    } catch {
      toast.error(t("errors.server"));
    }
  };

  // Optimistic: flip at once, roll back if the server refuses.
  const toggleSaved = async () => {
    const saved = !post.viewerSaved;
    onChange({ ...post, viewerSaved: saved });
    try {
      await apiFetch(`/api/posts/${post.id}/bookmark`, { method: saved ? "PUT" : "DELETE" });
      toast.success(t(saved ? "post.saved_toast" : "post.unsaved_toast"));
    } catch (error) {
      onChange({ ...post, viewerSaved: !saved });
      toast.error(describeApiError(error, t));
    }
  };

  const profileHref = post.author.username ? `/profile/${encodeURIComponent(post.author.username)}` : undefined;

  return (
    <Card className="overflow-visible">
      <header className="flex items-start gap-3 px-4 pt-4">
        {profileHref ? (
          <Link href={profileHref} tabIndex={-1} aria-hidden>
            <UserAvatar userId={post.author.id} name={post.author.name} image={post.author.image} size="md" />
          </Link>
        ) : (
          <UserAvatar userId={post.author.id} name={post.author.name} image={post.author.image} size="md" />
        )}
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-1.5 text-[14.5px] leading-snug">
            {profileHref ? (
              <Link href={profileHref} className="font-semibold hover:underline">
                {post.author.name}
              </Link>
            ) : (
              <span className="font-semibold">{post.author.name}</span>
            )}
            {post.group ? (
              <>
                <span aria-hidden className="text-muted-foreground">▸</span>
                <Link href={`/groups/${post.group.slug}`} className="inline-flex items-center gap-1 font-semibold hover:underline">
                  <UsersRound className="size-3.5 text-muted-foreground" aria-hidden />
                  {post.group.name}
                </Link>
              </>
            ) : null}
          </p>
          <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
            <Link href={href} className="hover:underline" title={formatDateTime(post.createdAt)}>
              <time dateTime={post.createdAt}>{formatRelative(post.createdAt)}</time>
            </Link>
            {post.editedAt ? <span title={formatDateTime(post.editedAt)}>· {t("post.edited")}</span> : null}
            {post.location ? (
              <Link
                href={`/map?lat=${post.location.latitude}&lng=${post.location.longitude}`}
                className="inline-flex min-w-0 items-center gap-0.5 hover:underline"
              >
                · <MapPin className="size-3 shrink-0" aria-hidden />
                <span className="max-w-[10rem] truncate">{post.location.name}</span>
              </Link>
            ) : null}
            <span aria-hidden>·</span>
            {post.group?.privacy === "PRIVATE" ? (
              <Lock className="size-3" aria-label={t("groups.private")} />
            ) : (
              <Globe className="size-3" aria-label={t("groups.public")} />
            )}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t("post.menu")}
            className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-surface-muted hover:text-foreground"
          >
            <MoreHorizontal className="size-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuItem onSelect={() => void copyLink()}>
              <Link2 />
              {t("post.copy_link")}
            </DropdownMenuItem>
            {viewer ? (
              <DropdownMenuItem onSelect={() => void toggleSaved()}>
                {post.viewerSaved ? <BookmarkCheck /> : <Bookmark />}
                {post.viewerSaved ? t("post.unbookmark") : t("post.bookmark")}
              </DropdownMenuItem>
            ) : null}
            {isAuthor ? (
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil />
                {t("post.edit")}
              </DropdownMenuItem>
            ) : null}
            {viewer && !isAuthor ? (
              <DropdownMenuItem onSelect={() => setReporting(true)}>
                <Flag />
                {t("post.report")}
              </DropdownMenuItem>
            ) : null}
            {canRemove ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
                  {isAuthor ? <Trash2 /> : <ShieldAlert />}
                  {isAuthor ? t("post.delete") : t("post.remove")}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {post.repostOf ? (
        <p className="flex items-center gap-1.5 px-4 pt-2 text-[12.5px] text-muted-foreground">
          <Repeat2 className="size-3.5" aria-hidden />
          {t("share.shared")}
        </p>
      ) : null}

      {post.body ? (
        <div className={cn("px-4 pt-3", !expanded && onOpenComments && "cursor-pointer")} onClick={openFromContent}>
          <RichText
            text={showAll || !long ? post.body : `${post.body.slice(0, CLAMP_CHARS).trimEnd()}…`}
            mentions={post.mentions}
            className="whitespace-pre-line break-words text-[15px] leading-relaxed [overflow-wrap:anywhere]"
          />
          {long ? (
            <button type="button" onClick={() => setShowAll((value) => !value)} className="mt-1 text-[13.5px] font-semibold text-muted-foreground hover:underline">
              {showAll ? t("post.see_less") : t("post.see_more")}
            </button>
          ) : null}
        </div>
      ) : null}

      {post.poll ? (
        <div className="px-4 pt-3">
          <PollView
            postId={post.id}
            poll={post.poll}
            viewerVotes={post.viewerPollVotes}
            canVote={post.viewerCanInteract}
            showResults={isAuthor}
            onChange={(poll, viewerPollVotes) => onChange({ ...post, poll, viewerPollVotes })}
          />
        </div>
      ) : null}

      {post.repostOf ? (
        <div className="px-4 pt-3">
          <RepostEmbed original={post.repostOf} />
        </div>
      ) : null}

      {post.media.length > 0 ? (
        <div className={cn("pt-3", post.media.length === 1 ? "px-0" : "px-4")}>
          <MediaGrid media={post.media} />
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <ReactionSummary state={post} />
        <span className="flex items-center gap-3 text-[13px] text-muted-foreground">
          <button type="button" onClick={() => onOpenComments?.(post)} className="hover:underline">
            {t("feed.comments_count", { count: post.commentCount })}
          </button>
          {post.shareCount > 0 ? <span>{t("share.count", { count: post.shareCount })}</span> : null}
        </span>
      </div>

      <div className="mx-4 mt-2 flex items-center gap-1 border-t border-border/60 py-1">
        <ReactionButton
          postId={post.id}
          signedIn={viewer !== null}
          state={post}
          onChange={(next) => onChange({ ...post, ...next })}
        />
        <button
          type="button"
          onClick={() => onOpenComments?.(post)}
          className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-[13.5px] font-semibold text-muted-foreground transition-colors hover:bg-surface-muted"
        >
          <MessageCircle className="size-[18px]" aria-hidden />
          {t("post.comment")}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-[13.5px] font-semibold text-muted-foreground transition-colors hover:bg-surface-muted">
            <Share2 className="size-[18px]" aria-hidden />
            {t("post.share")}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            {viewer && shareTarget ? (
              <>
                <DropdownMenuItem onSelect={() => void shareNow()}>
                  <Repeat2 />
                  {t("share.now")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSharing(true)}>
                  <SquarePen />
                  {t("share.with_text")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            ) : null}
            <DropdownMenuItem onSelect={() => void copyLink()}>
              <Link2 />
              {t("post.copy_link")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isAuthor ? <PostEditDialog post={post} open={editing} onOpenChange={setEditing} onSaved={onChange} /> : null}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={isAuthor ? t("post.delete_title") : t("post.remove_title")}
        description={isAuthor ? t("post.delete_body") : t("post.remove_body")}
        busy={deleting}
        onConfirm={() => void remove()}
      />
      {viewer && shareTarget ? (
        <ShareDialog original={shareTarget} open={sharing} onOpenChange={setSharing} {...(onShared ? { onShared } : {})} />
      ) : null}
      {viewer ? <ReportDialog open={reporting} onOpenChange={setReporting} targetType="post" targetId={post.id} /> : null}
    </Card>
  );
}
