"use client";

import { Bookmark, BookmarkCheck, Check, Flag, Globe, Link2, MapPin, Lock, MessageCircle, MoreHorizontal, Pencil, Repeat2, Share2, ShieldAlert, Trash2, UsersRound } from "lucide-react";
import Link from "@/components/ui/link";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { GroupRoleBadge } from "@/components/groups/group-role-badge";
import { useTranslation } from "@/components/providers/i18n-provider";
import { useFormatters } from "@/hooks/use-formatters";
import { UserAvatar } from "@/components/shell/user-avatar";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/lib/i18n";
import type { FeedItemDto } from "@/modules/posts/posts.dto";

import { AUDIENCES, AudienceIcon, type Audience } from "./audience";
import { MediaGrid } from "./media-grid";
import { PollView } from "./poll-view";
import { PostEditDialog } from "./post-edit-dialog";
import { ReactionButton, ReactionSummary } from "./reaction-picker";
import { ReportDialog } from "./report-dialog";
import { RepostEmbed } from "./repost-embed";
import { RichText } from "./rich-text";
import { ShareDialog } from "./share-dialog";

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
  const fmt = useFormatters();
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
    : post.published && post.audience === "PUBLIC" && (post.group === null || post.group.privacy === "PUBLIC")
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

  const changeAudience = async (audience: Audience) => {
    if (audience === post.audience) return;
    try {
      const response = await apiFetch<{ data: FeedItemDto }>(`/api/posts/${post.id}`, { method: "PATCH", body: { audience } });
      onChange(response.data);
      toast.success(t("audience.changed"));
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
          <p className="flex flex-wrap items-center gap-x-1.5 text-[0.9062rem] leading-snug">
            {profileHref ? (
              <Link href={profileHref} className="font-semibold hover:underline">
                {post.author.name}
              </Link>
            ) : (
              <span className="font-semibold">{post.author.name}</span>
            )}
            <GroupRoleBadge role={post.authorGroupRole} size="xs" />
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
          <p className="flex items-center gap-1.5 text-[0.7812rem] text-muted-foreground">
            <Link href={href} className="hover:underline" title={fmt.dateTime(post.createdAt)}>
              <time dateTime={post.createdAt}>{fmt.relative(post.createdAt)}</time>
            </Link>
            {post.editedAt ? <span title={fmt.dateTime(post.editedAt)}>· {t("post.edited")}</span> : null}
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
            {post.group ? (
              post.group.privacy === "PRIVATE" ? (
                <Lock className="size-3" aria-label={t("groups.private")} />
              ) : (
                <Globe className="size-3" aria-label={t("groups.public")} />
              )
            ) : (
              <AudienceIcon audience={post.audience} />
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
            {isAuthor && !post.group ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <AudienceIcon audience={post.audience} className="size-4" />
                  {t("audience.change")}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-48">
                  {AUDIENCES.map((audience) => (
                    <DropdownMenuItem key={audience} onSelect={() => void changeAudience(audience)}>
                      <AudienceIcon audience={audience} className="size-4" />
                      {t(`audience.${audience}` as MessageKey)}
                      {audience === post.audience ? <Check className="ml-auto" /> : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
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
                {!isAuthor ? <DropdownMenuLabel className="text-[0.7188rem] text-muted-foreground">{t("post.moderator_action")}</DropdownMenuLabel> : null}
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
        <p className="flex items-center gap-1.5 px-4 pt-2 text-[0.7812rem] text-muted-foreground">
          <Repeat2 className="size-3.5" aria-hidden />
          {t("share.shared")}
        </p>
      ) : null}

      {post.body ? (
        <div className={cn("px-4 pt-3", !expanded && onOpenComments && "cursor-pointer")} onClick={openFromContent}>
          <RichText
            text={showAll || !long ? post.body : `${post.body.slice(0, CLAMP_CHARS).trimEnd()}…`}
            mentions={post.mentions}
            className="whitespace-pre-line break-words text-[0.9375rem] leading-relaxed [overflow-wrap:anywhere]"
          />
          {long ? (
            <button type="button" onClick={() => setShowAll((value) => !value)} className="mt-1 text-[0.8438rem] font-semibold text-muted-foreground hover:underline">
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
        <ReactionSummary state={post} postId={post.id} />
        <span className="flex items-center gap-3 text-[0.8125rem] text-muted-foreground">
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
          className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-[0.8438rem] font-semibold text-muted-foreground transition-colors hover:bg-surface-muted"
        >
          <MessageCircle className="size-[18px]" aria-hidden />
          {t("post.comment")}
        </button>
        <button
          type="button"
          onClick={() => (viewer ? setSharing(true) : void copyLink())}
          className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-[0.8438rem] font-semibold text-muted-foreground transition-colors hover:bg-surface-muted"
        >
          <Share2 className="size-[18px]" aria-hidden />
          {t("post.share")}
          {post.shareCount > 0 ? <span className="tabular-nums">· {post.shareCount}</span> : null}
        </button>
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
      {viewer ? (
        <ShareDialog original={shareTarget} postId={post.repostOf?.available ? post.repostOf.id : post.id} open={sharing} onOpenChange={setSharing} {...(onShared ? { onShared } : {})} />
      ) : null}
      {viewer ? <ReportDialog open={reporting} onOpenChange={setReporting} targetType="post" targetId={post.id} /> : null}
    </Card>
  );
}
