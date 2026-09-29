"use client";

import { useCallback, useEffect, useState } from "react";

import { useRealtime } from "@/components/providers/realtime-provider";
import { apiFetch, ApiRequestError, toQueryString } from "@/lib/api/client";
import type { NotificationPayload } from "@/lib/socket/events";
import type { ListMeta } from "@/types";

export interface UseNotificationsResult {
  readonly items: readonly NotificationPayload[];
  readonly meta: ListMeta | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly unreadOnly: boolean;
  setUnreadOnly: (value: boolean) => void;
  setPage: (page: number) => void;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

/**
 * Paginated notification list for the full page view.
 *
 * The bell uses the shared realtime context; this hook exists for the page,
 * which needs filters and paging that the bell does not. Both read the same
 * endpoint, so the badge count and the list can never drift apart.
 *
 * Mutations go through the realtime context so a "mark all read" performed on
 * the page also clears the bell immediately.
 */
export function useNotifications(options: { limit?: number } = {}): UseNotificationsResult {
  const limit = options.limit ?? 20;
  const realtime = useRealtime();

  const [items, setItems] = useState<readonly NotificationPayload[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch<{ data: NotificationPayload[]; meta: ListMeta }>(
        `/api/notifications${toQueryString({ page, limit, unreadOnly: unreadOnly || undefined })}`,
      );
      setItems(response.data);
      setMeta(response.meta);
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.isAuthError) return;
      setError(
        caught instanceof ApiRequestError ? caught.code : "INTERNAL_ERROR",
      );
    } finally {
      setLoading(false);
    }
  }, [page, limit, unreadOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  // A pushed notification should appear on the page too, not only in the bell.
  useEffect(() => {
    if (!realtime.notifications[0]) return;
    const newest = realtime.notifications[0];
    setItems((current) =>
      current.some((item) => item.id === newest.id) ? current : [newest, ...current].slice(0, limit),
    );
  }, [realtime.notifications, limit]);

  const markRead = useCallback(
    async (id: string) => {
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, read: true } : item)),
      );
      await realtime.markRead(id);
    },
    [realtime],
  );

  const markAllRead = useCallback(async () => {
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    await realtime.markAllRead();
  }, [realtime]);

  return {
    items,
    meta,
    loading,
    error,
    unreadOnly,
    setUnreadOnly: (value) => {
      setUnreadOnly(value);
      setPage(1);
    },
    setPage,
    refresh: load,
    markRead,
    markAllRead,
  };
}
