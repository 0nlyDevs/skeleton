"use client";

import { useCallback, useEffect, useState } from "react";

import { useSocket, useSocketSubscription } from "@/hooks/use-socket";
import { apiFetch, toQueryString } from "@/lib/api/client";
import { SOCKET_EVENTS, type CommentEventPayload } from "@/lib/socket/events";
import type { CommentDto } from "@/modules/comments/comments.dto";

interface CommentPage {
  readonly data: CommentDto[];
  readonly nextCursor: string | null;
}

function upsert(list: CommentDto[], comment: CommentDto): CommentDto[] {
  if (comment.parentId) {
    return list.map((thread) =>
      thread.id === comment.parentId
        ? {
            ...thread,
            replies: thread.replies.some((reply) => reply.id === comment.id)
              ? thread.replies.map((reply) => (reply.id === comment.id ? comment : reply))
              : [...thread.replies, comment],
          }
        : thread,
    );
  }
  return list.some((thread) => thread.id === comment.id)
    ? list.map((thread) => (thread.id === comment.id ? { ...comment, replies: thread.replies } : thread))
    : [...list, comment];
}

/**
 * One post's thread: paginated load, live updates from `post:<id>` (joined
 * only while the thread is open), and local upserts for the viewer's own
 * actions (deduplicated by id when the socket echoes them back).
 */
export function useComments(postId: string | null) {
  const { socket } = useSocket();
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(
    async (cursor?: string) => {
      if (!postId) return;
      setLoading(true);
      setError(null);
      try {
        const page = await apiFetch<CommentPage>(`/api/posts/${encodeURIComponent(postId)}/comments${toQueryString({ cursor, limit: 20 })}`);
        setComments((current) => (cursor ? page.data.reduce(upsert, current) : page.data));
        setNextCursor(page.nextCursor);
      } catch (caught) {
        setError(caught);
      } finally {
        setLoading(false);
      }
    },
    [postId],
  );

  useEffect(() => {
    setComments([]);
    setNextCursor(null);
    if (postId) void load();
  }, [postId, load]);

  useSocketSubscription(
    postId ? (s) => s.emit(SOCKET_EVENTS.postSubscribe, postId) : null,
    postId ? (s) => s.emit(SOCKET_EVENTS.postUnsubscribe, postId) : null,
    postId,
  );

  useEffect(() => {
    if (!socket || !postId) return;
    const onComment = (payload: CommentEventPayload) => {
      if (payload.postId !== postId) return;
      setComments((current) => upsert(current, payload.comment));
    };
    socket.on(SOCKET_EVENTS.comment, onComment);
    return () => {
      socket.off(SOCKET_EVENTS.comment, onComment);
    };
  }, [socket, postId]);

  const apply = useCallback((comment: CommentDto) => setComments((current) => upsert(current, comment)), []);

  return { comments, nextCursor, loading, error, load, apply };
}
