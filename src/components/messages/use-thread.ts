"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useSocket } from "@/hooks/use-socket";
import { apiFetch, toQueryString } from "@/lib/api/client";
import {
  SOCKET_EVENTS,
  type MessageHiddenPayload,
  type MessagePayload,
  type RoomReadPayload,
  type SendMessageAck,
  type TypingPayload,
} from "@/lib/socket/events";
import type { RoomMemberDto } from "@/modules/messages/messages.dto";

export interface ThreadMessage extends MessagePayload {
  /** Client-side only: an optimistic message waiting for the server. */
  readonly pending?: boolean;
  readonly failed?: string;
}

interface MessagesResponse {
  readonly data: MessagePayload[];
  readonly meta?: { readonly hasMore: boolean };
}

const PAGE = 30;
const SEND_TIMEOUT_MS = 10_000;
const FALLBACK_POLL_MS = 15_000;

function sortByTime(list: ThreadMessage[]): ThreadMessage[] {
  return [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

/**
 * One conversation, socket-first: messages, edits, "deleted for me/everyone",
 * typing and read receipts all arrive as socket frames. Sending goes over the
 * socket with an acknowledgement (HTTP only if the socket is down), with an
 * optimistic bubble that is replaced by the persisted one.
 */
export function useThread(roomId: string | null, viewer: { id: string; name: string; image: string | null }) {
  const { socket, status } = useSocket();
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [members, setMembers] = useState<RoomMemberDto[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [typing, setTyping] = useState<ReadonlyMap<string, string>>(new Map());
  const typingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const lastTypingSent = useRef(0);

  const loadMembers = useCallback(async () => {
    if (!roomId) return;
    try {
      const response = await apiFetch<{ data: RoomMemberDto[] } | RoomMemberDto[]>(`/api/messages/rooms/${encodeURIComponent(roomId)}/members`);
      setMembers(Array.isArray(response) ? response : response.data);
    } catch {
      setMembers([]);
    }
  }, [roomId]);

  const markRead = useCallback(() => {
    if (!roomId || document.visibilityState !== "visible") return;
    void apiFetch(`/api/messages/rooms/${encodeURIComponent(roomId)}/read`, { method: "POST" }).catch(() => undefined);
  }, [roomId]);

  useEffect(() => {
    setMessages([]);
    setMembers([]);
    setTyping(new Map());
    if (!roomId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void apiFetch<MessagesResponse>(`/api/messages${toQueryString({ roomId, limit: PAGE })}`)
      .then((response) => {
        if (cancelled) return;
        setMessages(response.data);
        setHasMore(response.meta?.hasMore ?? response.data.length === PAGE);
      })
      .catch((caught: unknown) => !cancelled && setError(caught))
      .finally(() => !cancelled && setLoading(false));
    void loadMembers();
    return () => {
      cancelled = true;
    };
  }, [roomId, loadMembers]);

  const loadOlder = useCallback(async () => {
    const first = messages.find((message) => !message.pending);
    if (!roomId || !first || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const response = await apiFetch<MessagesResponse>(
        `/api/messages${toQueryString({ roomId, limit: PAGE, before: first.createdAt, beforeId: first.id })}`,
      );
      setMessages((current) => {
        const known = new Set(current.map((message) => message.id));
        return sortByTime([...response.data.filter((message) => !known.has(message.id)), ...current]);
      });
      setHasMore(response.meta?.hasMore ?? false);
    } finally {
      setLoadingOlder(false);
    }
  }, [roomId, messages, loadingOlder]);

  // Live frames for this conversation.
  useEffect(() => {
    if (!socket || !roomId) return;
    socket.emit(SOCKET_EVENTS.joinRoom, roomId);

    const onMessage = (message: MessagePayload) => {
      if (message.roomId !== roomId) return;
      setMessages((current) => (current.some((entry) => entry.id === message.id) ? current : sortByTime([...current, message])));
      setTyping((current) => {
        if (!current.has(message.sender.id)) return current;
        const next = new Map(current);
        next.delete(message.sender.id);
        return next;
      });
      if (message.sender.id !== viewer.id) markRead();
    };
    const onUpdated = (message: MessagePayload) => {
      if (message.roomId !== roomId) return;
      setMessages((current) => current.map((entry) => (entry.id === message.id ? message : entry)));
    };
    const onHidden = (payload: MessageHiddenPayload) => {
      if (payload.roomId !== roomId) return;
      setMessages((current) => current.filter((entry) => entry.id !== payload.messageId));
    };
    const onRead = (payload: RoomReadPayload) => {
      if (payload.roomId !== roomId) return;
      setMembers((current) => current.map((member) => (member.userId === payload.userId ? { ...member, lastReadAt: payload.lastReadAt } : member)));
    };
    const onTyping = (payload: TypingPayload) => {
      if (payload.roomId !== roomId || payload.userId === viewer.id) return;
      setTyping((current) => {
        const next = new Map(current);
        if (payload.typing) next.set(payload.userId, payload.name);
        else next.delete(payload.userId);
        return next;
      });
      const timers = typingTimers.current;
      const existing = timers.get(payload.userId);
      if (existing) clearTimeout(existing);
      if (payload.typing) {
        timers.set(payload.userId, setTimeout(() => {
          setTyping((current) => {
            const next = new Map(current);
            next.delete(payload.userId);
            return next;
          });
        }, 6_000));
      }
    };
    const onMembers = (payload: { roomId: string }) => {
      if (payload.roomId === roomId) void loadMembers();
    };

    socket.on(SOCKET_EVENTS.message, onMessage);
    socket.on(SOCKET_EVENTS.messageUpdated, onUpdated);
    socket.on(SOCKET_EVENTS.messageHidden, onHidden);
    socket.on(SOCKET_EVENTS.roomRead, onRead);
    socket.on(SOCKET_EVENTS.typingUpdate, onTyping);
    socket.on(SOCKET_EVENTS.roomMembers, onMembers);
    return () => {
      socket.off(SOCKET_EVENTS.message, onMessage);
      socket.off(SOCKET_EVENTS.messageUpdated, onUpdated);
      socket.off(SOCKET_EVENTS.messageHidden, onHidden);
      socket.off(SOCKET_EVENTS.roomRead, onRead);
      socket.off(SOCKET_EVENTS.typingUpdate, onTyping);
      socket.off(SOCKET_EVENTS.roomMembers, onMembers);
    };
  }, [socket, roomId, viewer.id, markRead, loadMembers]);

  // Mark read when the tab comes back into view.
  useEffect(() => {
    const onVisible = () => markRead();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [markRead]);

  // Last-resort fallback, only once the socket has failed repeatedly.
  useEffect(() => {
    if (status !== "polling" || !roomId) return;
    const timer = setInterval(() => {
      const last = [...messages].reverse().find((message) => !message.pending);
      void apiFetch<MessagesResponse>(`/api/messages${toQueryString({ roomId, limit: 50, since: last?.createdAt, afterId: last?.id })}`)
        .then((response) => {
          if (response.data.length === 0) return;
          setMessages((current) => {
            const known = new Set(current.map((message) => message.id));
            return sortByTime([...current, ...response.data.filter((message) => !known.has(message.id))]);
          });
        })
        .catch(() => undefined);
    }, FALLBACK_POLL_MS);
    return () => clearInterval(timer);
  }, [status, roomId, messages]);

  const send = useCallback(
    async (content: string, uploadId?: string, previewUrl?: string): Promise<void> => {
      if (!roomId) return;
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const optimistic: ThreadMessage = {
        id: tempId,
        roomId,
        content,
        deleted: false,
        editedAt: null,
        image: uploadId && previewUrl ? { id: uploadId, url: previewUrl, width: null, height: null } : null,
        sender: { id: viewer.id, name: viewer.name, username: null, image: viewer.image },
        createdAt: new Date().toISOString(),
        reactions: [],
      pending: true,
      };
      setMessages((current) => [...current, optimistic]);

      const settle = (message: MessagePayload | null, failure?: string) =>
        setMessages((current) => {
          if (message) {
            const withoutTemp = current.filter((entry) => entry.id !== tempId);
            return withoutTemp.some((entry) => entry.id === message.id) ? withoutTemp : sortByTime([...withoutTemp, message]);
          }
          return current.map((entry) => (entry.id === tempId ? { ...entry, pending: false, failed: failure ?? "error" } : entry));
        });

      const payload = { roomId, content, ...(uploadId ? { uploadId } : {}) };
      if (socket?.connected) {
        socket.timeout(SEND_TIMEOUT_MS).emit(SOCKET_EVENTS.sendMessage, payload, (timeoutError: Error | null, ack: SendMessageAck) => {
          if (timeoutError) settle(null, "timeout");
          else if (ack.ok) settle(ack.message);
          else settle(null, ack.message);
        });
        return;
      }
      try {
        const response = await apiFetch<MessagePayload | { data: MessagePayload }>("/api/messages", { method: "POST", body: payload });
        settle("data" in response ? response.data : response);
      } catch (caught) {
        settle(null, caught instanceof Error ? caught.message : "error");
      }
    },
    [roomId, socket, viewer.id, viewer.name, viewer.image],
  );

  const discardFailed = useCallback((id: string) => setMessages((current) => current.filter((entry) => entry.id !== id)), []);

  const notifyTyping = useCallback(() => {
    if (!socket?.connected || !roomId) return;
    const now = Date.now();
    if (now - lastTypingSent.current < 2_500) return;
    lastTypingSent.current = now;
    socket.emit(SOCKET_EVENTS.typing, { roomId, typing: true });
  }, [socket, roomId]);

  const replaceMessage = useCallback((message: MessagePayload) => {
    setMessages((current) => current.map((entry) => (entry.id === message.id ? message : entry)));
  }, []);

  const removeMessage = useCallback((id: string) => setMessages((current) => current.filter((entry) => entry.id !== id)), []);

  return {
    messages,
    members,
    hasMore,
    loading,
    loadingOlder,
    error,
    typing,
    loadOlder,
    send,
    discardFailed,
    notifyTyping,
    replaceMessage,
    removeMessage,
    reloadMembers: loadMembers,
  };
}
