"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useProfileOverridesListener } from "@/hooks/use-profile-overrides";
import { useSocket, type SocketStatus } from "@/hooks/use-socket";
import { useTranslation } from "@/components/providers/i18n-provider";
import { apiFetch, ApiRequestError } from "@/lib/api/client";
import { SOCKET_EVENTS, type MessageAlertPayload, type NotificationPayload, type ReadyPayload, type RoomReadPayload } from "@/lib/socket/events";
import type { ListMeta, NotificationType } from "@/types";

interface RealtimeContextValue {
  readonly status: SocketStatus;
  readonly notifications: readonly NotificationPayload[];
  readonly unreadCount: number;
  readonly loading: boolean;
  /** Unread messages per private conversation, live. */
  readonly messageUnread: Readonly<Record<string, number>>;
  readonly messageUnreadTotal: number;
  readonly viewerId: string | null;
  clearRoomUnread: (roomId: string) => void;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

interface NotificationsResponse {
  readonly data: NotificationPayload[];
  readonly meta: ListMeta;
}

const BELL_LIMIT = 12;

/**
 * Owns the notification stream for the whole tab.
 *
 * One component holds the state and everyone else reads it, so the bell, the
 * list page and any toast can never disagree about the unread count.
 *
 * Delivery has two paths and they are deliberately independent:
 *   * the socket pushes a frame the moment a notification is created, and
 *   * a refresh on mount (and on reconnect) reconciles anything missed while the
 *     tab was closed or the connection was down.
 *
 * The second path is what makes the polling fallback sufficient: if WebSockets
 * are blocked entirely, the bell still fills in on every navigation and refresh.
 */
export function RealtimeProvider({
  children,
  viewerId,
}: {
  children: React.ReactNode;
  readonly viewerId: string | null;
}) {
  const { socket, status } = useSocket();
  // One listener for live identity changes (avatars, names) app-wide.
  useProfileOverridesListener();

  /*
   * The socket is authenticated once, at handshake. A tab that signs in or out
   * through client-side navigation keeps the same socket, which would then speak
   * for the previous identity (a guest socket after sign-in: every chat event is
   * refused). The server announces who it thinks we are in `session:ready`; when
   * that disagrees with the session the page was rendered for, re-handshake.
   */
  const handshakeUser = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!socket) return;
    const onReady = (payload: ReadyPayload) => {
      handshakeUser.current = payload.user?.id ?? null;
      if (handshakeUser.current !== viewerId) {
        socket.disconnect();
        socket.connect();
      }
    };
    socket.on(SOCKET_EVENTS.ready, onReady);
    // The identity may already be known from an earlier handshake.
    if (handshakeUser.current !== undefined && handshakeUser.current !== viewerId && socket.connected) {
      socket.disconnect();
      socket.connect();
    }
    return () => {
      socket.off(SOCKET_EVENTS.ready, onReady);
    };
  }, [socket, viewerId]);
  const t = useTranslation();

  const [notifications, setNotifications] = useState<readonly NotificationPayload[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const seenIds = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    try {
      const all = await apiFetch<NotificationsResponse>(
        `/api/notifications?limit=${BELL_LIMIT}`,
      );
      const unread = await apiFetch<NotificationsResponse>(
        `/api/notifications?unreadOnly=true&limit=1`,
      );

      seenIds.current = new Set(all.data.map((item) => item.id));
      setNotifications(all.data);
      setUnreadCount(unread.meta.total);
    } catch (caught) {
      // A 401 is expected when the user is not yet authenticated (e.g. on the
      // login page). Silently ignore it — the bell simply stays empty.
      if (caught instanceof ApiRequestError && caught.isAuthError) return;
      // A failed refresh leaves the previous state in place: stale data is
      // better than an empty bell.
    } finally {
      setLoading(false);
    }
  }, []);

  // --- unread messages -----------------------------------------------------
  const [messageUnread, setMessageUnread] = useState<Readonly<Record<string, number>>>({});
  const refreshMessageUnread = useCallback(async () => {
    try {
      const response = await apiFetch<{ data: { rooms: Record<string, number> } }>("/api/messages/unread");
      setMessageUnread(response.data.rooms);
    } catch {
      // Keep the previous counts; the next reconnect reconciles.
    }
  }, []);
  const clearRoomUnread = useCallback((roomId: string) => {
    setMessageUnread((current) => (current[roomId] ? { ...current, [roomId]: 0 } : current));
  }, []);

  useEffect(() => {
    if (!viewerId) {
      setMessageUnread({});
      return;
    }
    void refreshMessageUnread();
  }, [viewerId, refreshMessageUnread, status]);

  useEffect(() => {
    if (!socket || !viewerId) return;
    const onUnread = (payload: { roomId: string; increment: number }) => {
      setMessageUnread((current) => ({ ...current, [payload.roomId]: (current[payload.roomId] ?? 0) + payload.increment }));
    };
    const onRead = (payload: RoomReadPayload) => {
      if (payload.userId === viewerId) clearRoomUnread(payload.roomId);
    };
    socket.on(SOCKET_EVENTS.roomUnread, onUnread);
    socket.on(SOCKET_EVENTS.roomRead, onRead);
    return () => {
      socket.off(SOCKET_EVENTS.roomUnread, onUnread);
      socket.off(SOCKET_EVENTS.roomRead, onRead);
    };
  }, [socket, viewerId, clearRoomUnread]);

  const messageUnreadTotal = useMemo(
    () => Object.values(messageUnread).reduce((sum, count) => sum + count, 0),
    [messageUnread],
  );

  // Guests have no notifications: skip the request instead of collecting 401s.
  useEffect(() => {
    if (!viewerId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }
    void refresh();
  }, [refresh, viewerId]);

  // Reconcile after a reconnect, when frames may have been missed.
  useEffect(() => {
    if (status !== "socket" || !viewerId) return;
    void refresh();
  }, [status, refresh, viewerId]);

  useEffect(() => {
    if (!socket) return;

    const onNew = (payload: NotificationPayload) => {
      // The socket and the refresh path can race; de-duplicate by id.
      if (seenIds.current.has(payload.id)) return;
      seenIds.current.add(payload.id);

      setNotifications((current) => [payload, ...current].slice(0, BELL_LIMIT));
      if (!payload.read) setUnreadCount((count) => count + 1);

      // A message notification while the inbox is open is noise.
      if (payload.type === "NEW_MESSAGE" && window.location.pathname.startsWith("/messages")) return;

      // City alerts get their own dialog and banner (AlertWatcher), not a second toast.
      if (payload.type === "ALERT") return;

      toast(payload.title, {
        description: payload.body ?? undefined,
        action: payload.link
          ? { label: t("notifications.view_all"), onClick: () => window.location.assign(payload.link as string) }
          : undefined,
      });
    };

    // New chat messages: a popup with a shortcut, never a bell entry. Silent
    // when that conversation (or the inbox) is already on screen.
    const onMessageAlert = (payload: MessageAlertPayload) => {
      if (window.location.pathname.startsWith("/messages")) return;
      toast(t("messages.alert_title", { name: payload.senderName }), {
        description: payload.preview,
        action: { label: t("messages.alert_open"), onClick: () => window.location.assign(`/messages?room=${encodeURIComponent(payload.roomId)}`) },
      });
    };

    socket.on(SOCKET_EVENTS.notification, onNew);
    socket.on(SOCKET_EVENTS.messageAlert, onMessageAlert);
    return () => {
      socket.off(SOCKET_EVENTS.notification, onNew);
      socket.off(SOCKET_EVENTS.messageAlert, onMessageAlert);
    };
  }, [socket, t]);

  const markRead = useCallback(async (id: string) => {
    // Optimistic: the badge responds immediately, and the server call is the
    // source of truth on the next refresh.
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
    setUnreadCount((count) => Math.max(0, count - 1));

    try {
      await apiFetch("/api/notifications/read", { method: "POST", body: { ids: [id] } });
    } catch {
      void refresh();
    }
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);

    try {
      await apiFetch("/api/notifications/read", { method: "POST", body: {} });
      toast.success(t("notifications.marked_all"));
    } catch {
      void refresh();
    }
  }, [refresh, t]);

  const value = useMemo<RealtimeContextValue>(
    () => ({
      status,
      notifications,
      unreadCount,
      loading,
      messageUnread,
      messageUnreadTotal,
      viewerId,
      clearRoomUnread,
      refresh,
      markRead,
      markAllRead,
    }),
    [
      status,
      notifications,
      unreadCount,
      loading,
      messageUnread,
      messageUnreadTotal,
      viewerId,
      clearRoomUnread,
      refresh,
      markRead,
      markAllRead,
    ],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeContextValue {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error("useRealtime must be used inside a RealtimeProvider.");
  }
  return context;
}

export type { NotificationType };
