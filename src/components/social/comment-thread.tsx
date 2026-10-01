"use client";

import { CornerDownRight, Send } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ReportContentButton } from "@/components/social/report-content-button";
import { useSocket, useSocketSubscription } from "@/hooks/use-socket";
import { apiFetch, toQueryString } from "@/lib/api/client";
import { formatRelative } from "@/lib/format";
import { SOCKET_EVENTS, type CommentEventPayload } from "@/lib/socket/events";
import type { CommentDto } from "@/modules/comments/comments.dto";
import type { AuthUser } from "@/types";

interface CommentPageResponse {
  readonly data: CommentDto[];
  readonly nextCursor: string | null;
}

export function CommentThread({
  postId,
  viewer,
  initialCount,
}: {
  readonly postId: string;
  readonly viewer: AuthUser | null;
  readonly initialCount: number;
}) {
  const t = useTranslation();
  const { socket } = useSocket();
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [body, setBody] = useState("");
  const [replyingTo, setReplyingTo] = useState<CommentDto | null>(null);
  const [busy, setBusy] = useState(false);

  const mergeEvent = useCallback((payload: CommentEventPayload) => {
    if (payload.postId !== postId) return;
    setComments((current) => {
      const walk = (items: CommentDto[]): { items: CommentDto[]; found: boolean } => {
        let found = false;
        const next = items.map((item) => {
          if (item.id === payload.comment.id) {
            found = true;
            return payload.comment;
          }
          const nested = walk(item.replies);
          if (nested.found) {
            found = true;
            return { ...item, replies: nested.items };
          }
          return item;
        });
        return { items: next, found };
      };
      const updated = walk(current);
      if (updated.found || payload.kind === "deleted") return updated.items;
      if (payload.comment.parentId) {
        const appendReply = (items: CommentDto[]): CommentDto[] => items.map((item) =>
          item.id === payload.comment.parentId
            ? { ...item, replies: [...item.replies, payload.comment] }
            : { ...item, replies: appendReply(item.replies) },
        );
        return appendReply(updated.items);
      }
      return [...updated.items, payload.comment];
    });
  }, [postId]);

  useSocketSubscription(
    (instance) => instance.emit(SOCKET_EVENTS.postSubscribe, postId),
    (instance) => instance.emit(SOCKET_EVENTS.postUnsubscribe, postId),
    postId,
  );

  useEffect(() => {
    if (!socket) return;
    socket.on(SOCKET_EVENTS.comment, mergeEvent);
    return () => { socket.off(SOCKET_EVENTS.comment, mergeEvent); };
  }, [socket, mergeEvent]);

  useEffect(() => {
    let cancelled = false;
    void apiFetch<CommentPageResponse>(`/api/posts/${encodeURIComponent(postId)}/comments?limit=20`)
      .then((response) => {
        if (!cancelled) {
          setComments((current) => {
            const liveById = new Map(current.map((comment) => [comment.id, comment]));
            const loadedIds = new Set(response.data.map((comment) => comment.id));
            return [
              ...response.data.map((comment) => liveById.get(comment.id) ?? comment),
              ...current.filter((comment) => !loadedIds.has(comment.id)),
            ];
          });
          setNextCursor(response.nextCursor);
        }
      })
      .catch(() => { if (!cancelled) toast.error(t("feedback.network")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [postId, t]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanBody = body.trim();
    if (!cleanBody || !viewer || busy) return;
    setBusy(true);
    try {
      const response = await apiFetch<{ data: CommentDto }>(`/api/posts/${encodeURIComponent(postId)}/comments`, {
        method: "POST",
        body: { body: cleanBody, ...(replyingTo ? { parentId: replyingTo.id } : {}) },
      });
      mergeEvent({ kind: "created", postId, comment: response.data });
      setBody("");
      setReplyingTo(null);
    } catch {
      toast.error(t("feedback.error.body"));
    } finally {
      setBusy(false);
    }
  };

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await apiFetch<CommentPageResponse>(`/api/posts/${encodeURIComponent(postId)}/comments${toQueryString({ limit: 20, cursor: nextCursor })}`);
      setComments((current) => {
        const known = new Set(current.map((comment) => comment.id));
        return [...current, ...response.data.filter((comment) => !known.has(comment.id))];
      });
      setNextCursor(response.nextCursor);
    } catch {
      toast.error(t("feedback.network"));
    } finally {
      setLoadingMore(false);
    }
  };

  const renderComment = (comment: CommentDto, nested = false) => (
    <article key={comment.id} className={nested ? "border-l border-border/70 pl-4" : ""}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px]">
            {comment.author?.username ? <Link className="font-semibold hover:underline" href={`/u/${encodeURIComponent(comment.author.username)}`}>{comment.author.name}</Link> : <span className="font-semibold">{comment.author?.name ?? t("comments.deleted")}</span>}
            <time dateTime={comment.createdAt} className="text-muted-foreground">{formatRelative(comment.createdAt)}</time>
            {comment.editedAt ? <span className="text-muted-foreground">· {t("feed.edited")}</span> : null}
          </div>
          <p className={`mt-1 whitespace-pre-line break-words text-sm leading-relaxed ${comment.deleted ? "italic text-muted-foreground" : ""}`}>
            {comment.deleted ? t("comments.removed") : comment.body}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!nested && viewer && !comment.deleted ? <Button variant="ghost" size="sm" onClick={() => setReplyingTo(comment)}><CornerDownRight />{t("comments.reply")}</Button> : null}
          {viewer && comment.author && comment.author.id !== viewer.id && !comment.deleted ? <ReportContentButton targetType="comment" targetId={comment.id} signedIn label={t("comments.report")} compact /> : null}
        </div>
      </div>
      {comment.replies.length > 0 ? <div className="mt-3 flex flex-col gap-3">{comment.replies.map((reply) => renderComment(reply, true))}</div> : null}
    </article>
  );

  const count = Math.max(initialCount, comments.reduce((total, comment) => total + 1 + comment.replies.length, 0));

  return (
    <section id="comments" className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{t("comments.title")} <span className="text-sm font-normal text-muted-foreground">({count})</span></h2>
      {viewer ? (
        <Card className="p-3 sm:p-4">
          {replyingTo ? <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground"><span>{t("comments.replying_to", { name: replyingTo.author?.name ?? t("comments.deleted") })}</span><Button variant="ghost" size="sm" onClick={() => setReplyingTo(null)}>{t("common.cancel")}</Button></div> : null}
          <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-2">
            <Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder={replyingTo ? t("comments.reply_placeholder", { name: replyingTo.author?.name ?? t("comments.deleted") }) : t("comments.placeholder")} aria-label={t("comments.placeholder")} maxLength={2_000} required />
            <div className="flex justify-end"><Button type="submit" size="sm" disabled={busy || body.trim().length === 0}><Send />{t("comments.send")}</Button></div>
          </form>
        </Card>
      ) : <p className="text-sm text-muted-foreground"><Link href="/login" className="font-medium text-primary hover:underline">{t("comments.sign_in")}</Link></p>}
      {loading ? <p className="py-3 text-sm text-muted-foreground">{t("common.loading")}</p> : comments.length === 0 ? <p className="py-3 text-sm text-muted-foreground">{t("comments.empty")}</p> : <div className="flex flex-col gap-4">{comments.map((comment) => renderComment(comment))}</div>}
      {nextCursor ? <Button variant="secondary" disabled={loadingMore} onClick={() => void loadMore()}>{t("comments.load_more")}</Button> : null}
    </section>
  );
}
