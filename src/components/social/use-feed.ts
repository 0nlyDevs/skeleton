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

export interface FeedScope {
  readonly scope?: "all" | "following" | "for_you";
  readonly authorId?: string;
  readonly group?: { readonly id: string; readonly slug: string };
  /** The viewer's saved posts: no live inserts, only updates to listed posts. */
  readonly saved?: boolean;
}

const PAGE_SIZE = 10;
/** Only while the socket has failed for good; never the main path. */
const FALLBACK_POLL_MS = 30_000;

/**
 * Feed state: server-rendered first page, keyset "load more", live updates.
 *
 * Live posts from others wait behind a "N new posts" pill so the list never
 * jumps under the reader; the viewer's own posts appear at once. Broadcasts
 * are viewer-neutral, so viewer fields (`viewerReaction`, `viewerCan*`) are
 * kept when an update replaces an item.
 */
export function useFeed({ initial, viewerId, filter }: { readonly initial: FeedPageResponse; readonly viewerId: string | null; readonly filter: FeedScope }) {
  const { socket, status } = useSocket();
  const [items, setItems] = useState<FeedItemDto[]>(initial.data);
  const [pending, setPending] = useState<FeedItemDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(initial.nextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);
  const known = useRef(new Set(initial.data.map((item) => item.id)));

  const url = useCallback(
    (cursor?: string) =>
      filter.saved
        ? `/api/bookmarks${toQueryString({ limit: PAGE_SIZE, cursor })}`
        : `/api/feed${toQueryString({
        limit: PAGE_SIZE,
        cursor,
        authorId: filter.authorId,
        groupSlug: filter.group?.slug,
        scope: filter.scope && filter.scope !== "all" ? filter.scope : undefined,
      })}`,
    [filter.authorId, filter.group?.slug, filter.scope, filter.saved],
  );

  // A new filter (tab switch) restarts from the server.
  const filterKey = `${filter.scope ?? "all"}|${filter.authorId ?? ""}|${filter.group?.id ?? ""}`;
  const firstKey = useRef(filterKey);
  useEffect(() => {
    if (firstKey.current === filterKey) return;
    firstKey.current = filterKey;
    let cancelled = false;
    setItems([]);
    setPending([]);
    setLoadingMore(true);
    void apiFetch<FeedPageResponse>(url())
      .then((page) => {
        if (cancelled) return;
        known.current = new Set(page.data.map((item) => item.id));
        setItems(page.data);
        setNextCursor(page.nextCursor);
      })
      .catch((error: unknown) => !cancelled && setLoadError(error))
      .finally(() => !cancelled && setLoadingMore(false));
    return () => {
      cancelled = true;
    };
  }, [filterKey, url]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const page = await apiFetch<FeedPageResponse>(url(nextCursor));
      const fresh = page.data.filter((item) => !known.current.has(item.id));
      for (const item of fresh) known.current.add(item.id);
      setItems((current) => [...current, ...fresh]);
      setNextCursor(page.nextCursor);
    } catch (error) {
      setLoadError(error);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, url]);

  const showPending = useCallback(() => {
    setItems((current) => [...pending, ...current]);
    setPending([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pending]);

  const insert = useCallback((item: FeedItemDto) => {
    if (known.current.has(item.id)) return;
    known.current.add(item.id);
    setItems((current) => [item, ...current]);
  }, []);

  const replace = useCallback((item: FeedItemDto) => {
    const apply = (list: FeedItemDto[]) => list.map((entry) => (entry.id === item.id ? item : entry));
    setItems(apply);
    setPending(apply);
  }, []);

  const patch = useCallback((postId: string, update: Partial<FeedItemDto>) => {
    const apply = (list: FeedItemDto[]) => list.map((entry) => (entry.id === postId ? { ...entry, ...update } : entry));
    setItems(apply);
    setPending(apply);
  }, []);

  const remove = useCallback((postId: string) => {
    known.current.delete(postId);
    setItems((current) => current.filter((entry) => entry.id !== postId));
    setPending((current) => current.filter((entry) => entry.id !== postId));
  }, []);

  // Home and profiles follow the public feed (members are already in their
  // groups' rooms); a group page subscribes to that group (guests included).
  useSocketSubscription(
    (s) => (filter.group ? s.emit(SOCKET_EVENTS.groupSubscribe, filter.group.id) : s.emit(SOCKET_EVENTS.feedSubscribe)),
    (s) => (filter.group ? s.emit(SOCKET_EVENTS.groupUnsubscribe, filter.group.id) : s.emit(SOCKET_EVENTS.feedUnsubscribe)),
    filterKey,
  );

  useEffect(() => {
    if (!socket) return;
    const onPost = (payload: FeedPostPayload) => {
      if (payload.kind === "deleted" || !payload.post) {
        remove(payload.postId);
        return;
      }
      const post = payload.post;
      if (filter.authorId && post.author.id !== filter.authorId) return;
      if (filter.group && post.group?.id !== filter.group.id) return;
      if (!filter.group && !filter.authorId && filter.scope === "following" && post.author.id !== viewerId) return;

      if (known.current.has(post.id)) {
        const { viewerReaction: _r, viewerCanModerate: _m, viewerCanInteract: _i, viewerSaved: _s, ...shared } = post;
        patch(post.id, shared);
        return;
      }
      if (payload.kind === "updated" || filter.saved) return;
      if (post.author.id === viewerId) {
        // Our own post (from this tab it is already known; from another tab
        // it appears at once, no pill).
        insert({ ...post, viewerCanInteract: true });
        return;
      }
      known.current.add(post.id);
      setPending((current) => [{ ...post, viewerCanInteract: viewerId !== null && !post.group }, ...current]);
    };
    const onEngagement = (payload: PostEngagementPayload) => {
      patch(payload.postId, {
        commentCount: payload.commentCount,
        reactionCount: payload.reactionCount,
        reactions: payload.reactions,
        shareCount: payload.shareCount,
        poll: payload.poll,
      });
    };
    socket.on(SOCKET_EVENTS.feedPost, onPost);
    socket.on(SOCKET_EVENTS.postEngagement, onEngagement);
    return () => {
      socket.off(SOCKET_EVENTS.feedPost, onPost);
      socket.off(SOCKET_EVENTS.postEngagement, onEngagement);
    };
  }, [socket, filter.authorId, filter.group, filter.scope, filter.saved, viewerId, insert, patch, remove]);

  useEffect(() => {
    if (status !== "polling") return;
    const timer = setInterval(() => {
      void apiFetch<FeedPageResponse>(url())
        .then((page) => {
          const fresh = page.data.filter((item) => !known.current.has(item.id));
          for (const item of fresh) known.current.add(item.id);
          if (fresh.length > 0) setPending((current) => [...fresh, ...current]);
        })
        .catch(() => undefined);
    }, FALLBACK_POLL_MS);
    return () => clearInterval(timer);
  }, [status, url]);

  return { items, pending, nextCursor, loadingMore, loadError, loadMore, showPending, insert, replace, remove };
}
