"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useSocket, useSocketSubscription } from "@/hooks/use-socket";
import { apiFetch, toQueryString } from "@/lib/api/client";
import { SOCKET_EVENTS, type FeedPostPayload, type PostEngagementPayload } from "@/lib/socket/events";
import type { FeedItemDto } from "@/modules/posts/posts.dto";

export interface FeedPageResponse {
  readonly data: FeedItemDto[];
  readonly nextCursor: string | null;
}

const PAGE_SIZE = 10;
/** Only used while the socket is down for good; it is never the main path. */
const FALLBACK_POLL_MS = 30_000;

/**
 * Feed state: the server-rendered first page, keyset "load more", and live
 * updates from the `feed` socket room.
 *
 * New posts from others wait in `pending` behind a "N new posts" banner, so
 * the list never jumps under the reader's thumb; the viewer's own posts are
 * inserted at once. Viewer-specific fields (`viewerReaction`) are kept when a
 * neutral broadcast replaces an item.
 */
export function useFeed({
  initial,
  authorId,
  viewerId,
  scope,
  followedIds,
}: {
  readonly initial: FeedPageResponse;
  readonly authorId?: string;
  readonly viewerId: string | null;
  readonly scope?: "all" | "following";
  readonly followedIds?: readonly string[];
}) {
  const { socket, status } = useSocket();
  const [items, setItems] = useState<FeedItemDto[]>(initial.data);
  const [pending, setPending] = useState<FeedItemDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(initial.nextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const known = useRef(new Set(initial.data.map((item) => item.id)));

  const query = useCallback(
    (cursor?: string) =>
      `/api/feed${toQueryString({ limit: PAGE_SIZE, cursor, authorId, ...(scope === "following" ? { scope } : {}) })}`,
    [authorId, scope],
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await apiFetch<FeedPageResponse>(query(nextCursor));
      const fresh = page.data.filter((item) => !known.current.has(item.id));
      for (const item of fresh) known.current.add(item.id);
      setItems((current) => [...current, ...fresh]);
      setNextCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, query]);

  const showPending = useCallback(() => {
    setItems((current) => [...pending, ...current]);
    setPending([]);
  }, [pending]);

  const insert = useCallback((item: FeedItemDto) => {
    if (known.current.has(item.id)) return;
    known.current.add(item.id);
    setItems((current) => [item, ...current]);
  }, []);

  const patch = useCallback((postId: string, update: Partial<FeedItemDto>) => {
    const apply = (list: FeedItemDto[]) =>
      list.map((item) => (item.id === postId ? { ...item, ...update } : item));
    setItems(apply);
    setPending(apply);
  }, []);

  const remove = useCallback((postId: string) => {
    known.current.delete(postId);
    setItems((current) => current.filter((item) => item.id !== postId));
    setPending((current) => current.filter((item) => item.id !== postId));
  }, []);

  useSocketSubscription(
    (s) => s.emit(SOCKET_EVENTS.feedSubscribe),
    (s) => s.emit(SOCKET_EVENTS.feedUnsubscribe),
    "feed",
  );

  useEffect(() => {
    if (!socket) return;

    const onPost = (payload: FeedPostPayload) => {
      if (payload.kind === "deleted" || !payload.post) {
        remove(payload.postId);
        return;
      }
      const post = payload.post;
      if (authorId && post.author.id !== authorId) return;
      // The "following" scope is filtered server-side on load; live arrivals
      // from strangers are left for the next full load rather than guessed at.
      if (scope === "following" && post.author.id !== viewerId && !followedIds?.includes(post.author.id)) return;

      if (payload.kind === "updated" || known.current.has(post.id)) {
        const { viewerReaction: _neutral, ...shared } = post;
        patch(post.id, shared);
        return;
      }
      if (post.author.id === viewerId) {
        insert(post);
        return;
      }
      known.current.add(post.id);
      setPending((current) => [post, ...current]);
    };

    const onEngagement = (payload: PostEngagementPayload) => {
      patch(payload.postId, {
        commentCount: payload.commentCount,
        reactionCount: payload.reactionCount,
        reactions: payload.reactions,
      });
    };

    socket.on(SOCKET_EVENTS.feedPost, onPost);
    socket.on(SOCKET_EVENTS.postEngagement, onEngagement);
    return () => {
      socket.off(SOCKET_EVENTS.feedPost, onPost);
      socket.off(SOCKET_EVENTS.postEngagement, onEngagement);
    };
  }, [socket, authorId, scope, viewerId, followedIds, insert, patch, remove]);

  // Last-resort fallback: only when the socket has failed repeatedly.
  useEffect(() => {
    if (status !== "polling") return;
    const interval = setInterval(() => {
      void apiFetch<FeedPageResponse>(query())
        .then((page) => {
          const fresh = page.data.filter((item) => !known.current.has(item.id));
          for (const item of fresh) known.current.add(item.id);
          if (fresh.length > 0) setPending((current) => [...fresh, ...current]);
        })
        .catch(() => undefined);
    }, FALLBACK_POLL_MS);
    return () => clearInterval(interval);
  }, [status, query]);

  return { items, pending, pendingCount: pending.length, nextCursor, loadingMore, loadMore, showPending, insert, patch, remove };
}
