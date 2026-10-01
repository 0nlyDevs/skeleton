"use client";

import { Loader2, SendHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { UserAvatar } from "@/components/shell/user-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import type { CommentDto } from "@/modules/comments/comments.dto";

import { CommentItem } from "./comment-item";
import { MentionInput, type MentionInputHandle } from "./mention-input";
import { useComments } from "./use-comments";

export interface ThreadViewer {
  readonly id: string;
  readonly name: string;
  readonly image: string | null;
}

/** Scrollable thread + composer; the composer stays pinned at the bottom. */
export function CommentThread({
  postId,
  viewer,
  canComment,
  canModerate,
  className,
  autoFocus = false,
}: {
  readonly postId: string;
  readonly viewer: ThreadViewer | null;
  readonly canComment: boolean;
  readonly canModerate: boolean;
  readonly className?: string;
  readonly autoFocus?: boolean;
}) {
  const t = useTranslation();
  const { comments, nextCursor, loading, error, load, apply } = useComments(postId);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<CommentDto | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const input = useRef<MentionInputHandle>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const response = await apiFetch<{ data: CommentDto }>(`/api/posts/${encodeURIComponent(postId)}/comments`, {
        method: "POST",
        body: { body, ...(replyTo ? { parentId: replyTo.id } : {}) },
      });
      apply(response.data);
      setDraft("");
      setReplyTo(null);
      requestAnimationFrame(() => bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
    } catch (caught) {
      // The draft stays: nothing typed is ever lost to a failed request.
      setSendError(describeApiError(caught, t));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3" aria-live="polite">
        {loading && comments.length === 0 ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="flex gap-2.5">
                <Skeleton className="size-9 rounded-full" />
                <Skeleton className="h-12 w-2/3 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <p className="text-[13px] text-muted-foreground">{describeApiError(error, t)}</p>
            <Button size="sm" variant="secondary" onClick={() => void load()}>
              {t("common.retry")}
            </Button>
          </div>
        ) : comments.length === 0 ? (
          <p className="py-6 text-center text-[13.5px] text-muted-foreground">{t("comments.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {comments.map((thread) => (
              <li key={thread.id} className="flex flex-col gap-2">
                <CommentItem
                  comment={thread}
                  viewerId={viewer?.id ?? null}
                  canModerate={canModerate}
                  onReply={(comment) => {
                    setReplyTo(comment);
                    input.current?.focus();
                  }}
                  onChanged={apply}
                />
                {thread.replies.map((reply) => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    isReply
                    viewerId={viewer?.id ?? null}
                    canModerate={canModerate}
                    onReply={(comment) => {
                      setReplyTo(comment);
                      input.current?.focus();
                    }}
                    onChanged={apply}
                  />
                ))}
              </li>
            ))}
          </ul>
        )}
        {nextCursor ? (
          <button
            type="button"
            onClick={() => void load(nextCursor)}
            disabled={loading}
            className="mt-3 text-[13px] font-semibold text-muted-foreground hover:underline"
          >
            {t("comments.load_more")}
          </button>
        ) : null}
        <div ref={bottom} />
      </div>

      <div className="border-t border-border/60 bg-card px-4 py-3">
        {!viewer ? (
          <p className="text-center text-[13px] text-muted-foreground">
            <Link href="/login" className="font-semibold text-primary hover:underline">
              {t("comments.sign_in")}
            </Link>
          </p>
        ) : !canComment ? (
          <p className="text-center text-[13px] text-muted-foreground">{t("comments.join_group")}</p>
        ) : (
          <>
            {replyTo ? (
              <div className="mb-2 flex items-center justify-between rounded-lg bg-accent px-3 py-1.5 text-[12.5px] text-accent-foreground">
                <span>{t("comments.replying_to", { name: replyTo.author?.name ?? "…" })}</span>
                <button type="button" onClick={() => setReplyTo(null)} aria-label={t("comments.cancel_reply")}>
                  <X className="size-3.5" />
                </button>
              </div>
            ) : null}
            <div className="flex items-end gap-2">
              <UserAvatar name={viewer.name} image={viewer.image} size="sm" />
              <div className="flex min-w-0 flex-1 items-end rounded-2xl bg-surface-muted focus-within:ring-2 focus-within:ring-ring/25">
                <MentionInput
                  ref={input}
                  value={draft}
                  onChange={(value) => {
                    setDraft(value);
                    setSendError(null);
                  }}
                  onSubmit={() => void send()}
                  placeholder={replyTo ? t("comments.reply_placeholder", { name: replyTo.author?.name ?? "" }) : t("comments.placeholder")}
                  maxLength={2000}
                  maxRows={6}
                  suggestions="above"
                />
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={sending}
                  aria-label={t("comments.send")}
                  className={cn(
                    "m-1 grid size-8 shrink-0 place-items-center rounded-full transition-colors",
                    draft.trim() ? "text-primary hover:bg-accent" : "text-muted-foreground",
                  )}
                >
                  {sending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
                </button>
              </div>
            </div>
            {sendError ? <p role="alert" className="mt-1.5 text-[12.5px] text-error">{sendError}</p> : null}
          </>
        )}
      </div>
    </div>
  );
}
