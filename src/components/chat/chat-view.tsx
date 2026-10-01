"use client";

import { ArrowDownToLine, Loader2, MessageSquarePlus, MessagesSquare, Send, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/feedback/empty-state";
import { ChatConversationDialog, type ChatRoom } from "@/components/chat/chat-conversation-dialog";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ReportContentButton } from "@/components/social/report-content-button";
import { useSocket } from "@/hooks/use-socket";
import { apiFetch, ApiRequestError, toQueryString } from "@/lib/api/client";
import { formatRelative } from "@/lib/format";
import { SOCKET_EVENTS, type MessagePayload } from "@/lib/socket/events";
import { cn, initials } from "@/lib/utils";
import type { AuthUser } from "@/types";

interface MessagesResponse {
  readonly data: MessagePayload[];
  readonly meta?: { readonly hasMore?: boolean };
}

const MESSAGE_PAGE = 30;
const POLL_INTERVAL_MS = 8_000;
const TYPING_DEBOUNCE_MS = 2_500;

/** Chat prefers the shared Socket.IO connection and uses HTTP only after fallback. */
export function ChatView({ user }: { readonly user: AuthUser }) {
  const t = useTranslation();
  const { socket, status } = useSocket();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessagePayload[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [dialogMode, setDialogMode] = useState<"new" | "add" | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(messages);
  const lastTypingSentRef = useRef(0);
  const typingTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const queuedDraftRef = useRef<{ roomId: string; content: string } | null>(null);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const replaceOrAppendMessage = useCallback((payload: MessagePayload) => {
    setMessages((current) => {
      const index = current.findIndex((message) => message.id === payload.id);
      if (index < 0) return [...current, payload];
      const next = current.slice();
      next[index] = payload;
      return next;
    });
  }, []);

  const selectRoom = useCallback((roomId: string | null) => {
    setLoading(Boolean(roomId));
    setMessages([]);
    setHasMore(false);
    setTypingUsers(new Map());
    setOnlineCount(0);
    setActiveRoom(roomId);
  }, []);

  const markRead = useCallback(async (roomId: string) => {
    setRooms((current) => current.map((room) => room.id === roomId ? { ...room, unreadCount: 0 } : room));
    try {
      await apiFetch(`/api/messages/rooms/${encodeURIComponent(roomId)}/read`, { method: "POST" });
    } catch {
      // The next room-list refresh reconciles the badge if the read marker failed.
    }
  }, []);

  const reloadRooms = useCallback(async (preferredId?: string) => {
    const response = await apiFetch<{ data: ChatRoom[] }>("/api/messages/rooms");
    setRooms(response.data);
    const queryRoom = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("room");
    const requested = preferredId ?? queryRoom;
    const selected = requested && response.data.some((room) => room.id === requested)
      ? requested
      : activeRoom && response.data.some((room) => room.id === activeRoom)
        ? activeRoom
        : response.data[0]?.id ?? null;
    if (selected !== activeRoom) selectRoom(selected);
  }, [activeRoom, selectRoom]);

  useEffect(() => {
    let cancelled = false;
    void apiFetch<{ data: ChatRoom[] }>("/api/messages/rooms")
      .then((response) => {
        if (cancelled) return;
        setRooms(response.data);
        const requested = new URLSearchParams(window.location.search).get("room");
        const selected =
          requested && response.data.some((room) => room.id === requested)
            ? requested
            : response.data[0]?.id ?? null;
        setActiveRoom(selected);
        if (!selected) setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          toast.error(t("feedback.network"));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [t]);

  const loadHistory = useCallback(async (roomId: string, before?: MessagePayload) => {
    const response = await apiFetch<MessagesResponse>(
      `/api/messages${toQueryString({
        roomId,
        limit: MESSAGE_PAGE,
        before: before?.createdAt,
        beforeId: before?.id,
      })}`,
    );
    const page = response.data ?? [];
    setHasMore(response.meta?.hasMore ?? page.length === MESSAGE_PAGE);
    setMessages((current) => {
      if (!before) return page;
      const known = new Set(current.map((message) => message.id));
      return [...page.filter((message) => !known.has(message.id)), ...current];
    });
    return page;
  }, []);

  useEffect(() => {
    if (!activeRoom) return;
    let cancelled = false;
    void apiFetch<MessagesResponse>(
      `/api/messages${toQueryString({ roomId: activeRoom, limit: MESSAGE_PAGE })}`,
    )
      .then((response) => {
        if (cancelled) return;
        const page = response.data ?? [];
        setHasMore(response.meta?.hasMore ?? page.length === MESSAGE_PAGE);
        setMessages(page);
        void markRead(activeRoom);
      })
      .catch(() => { if (!cancelled) toast.error(t("feedback.network")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeRoom, markRead, t]);

  useEffect(() => {
    if (!socket || !activeRoom || status !== "socket" || !socket.connected) return;
    socket.emit(SOCKET_EVENTS.joinRoom, activeRoom);
    return () => { if (socket.connected) socket.emit(SOCKET_EVENTS.leaveRoom, activeRoom); };
  }, [socket, activeRoom, status]);

  useEffect(() => {
    if (!socket) return;
    const onMessage = (payload: MessagePayload) => {
      if (payload.roomId !== activeRoom) return;
      replaceOrAppendMessage(payload);
      setTypingUsers((current) => {
        if (!current.has(payload.sender.id)) return current;
        const next = new Map(current);
        next.delete(payload.sender.id);
        return next;
      });
      const queued = queuedDraftRef.current;
      if (queued?.roomId === payload.roomId && payload.sender.id === user.id && payload.content === queued.content) {
        queuedDraftRef.current = null;
        setSending(false);
      }
      void markRead(payload.roomId).finally(() => reloadRooms(payload.roomId).catch(() => undefined));
    };
    const onTyping = (payload: { roomId: string; userId: string; name: string; typing: boolean }) => {
      if (payload.roomId !== activeRoom || payload.userId === user.id) return;
      setTypingUsers((current) => {
        const next = new Map(current);
        if (payload.typing) next.set(payload.userId, payload.name);
        else next.delete(payload.userId);
        return next;
      });
      const timers = typingTimersRef.current;
      const existing = timers.get(payload.userId);
      if (existing) clearTimeout(existing);
      if (payload.typing) {
        timers.set(payload.userId, setTimeout(() => {
          setTypingUsers((current) => {
            const next = new Map(current);
            next.delete(payload.userId);
            return next;
          });
        }, 6_000));
      }
    };
    const onPresence = (payload: { roomId: string; online: number }) => {
      if (payload.roomId === activeRoom) setOnlineCount(payload.online);
    };
    const onUnread = (payload: { roomId: string; increment: number }) => {
      if (payload.roomId === activeRoom) {
        void markRead(payload.roomId);
        return;
      }
      setRooms((current) => current.map((room) => room.id === payload.roomId
        ? { ...room, unreadCount: room.unreadCount + payload.increment }
        : room));
    };
    const onRoomMembers = (payload: { roomId: string }) => {
      if (payload.roomId === activeRoom) void reloadRooms(activeRoom).catch(() => undefined);
    };
    const onError = (payload: { code: string; message: string }) => {
      if (payload.code === "RATE_LIMITED") toast.error(t("chat.rate_limited"));
      else if (payload.code === "FORBIDDEN" || payload.code === "NOT_FOUND") toast.error(t("feedback.forbidden.body"));
      else toast.error(payload.message || t("feedback.error.title"));
      const queued = queuedDraftRef.current;
      if (queued) {
        setDraft((current) => current || queued.content);
        queuedDraftRef.current = null;
        setSending(false);
      }
    };
    socket.on(SOCKET_EVENTS.message, onMessage);
    socket.on(SOCKET_EVENTS.typingUpdate, onTyping);
    socket.on(SOCKET_EVENTS.presence, onPresence);
    socket.on(SOCKET_EVENTS.roomUnread, onUnread);
    socket.on(SOCKET_EVENTS.roomMembers, onRoomMembers);
    socket.on(SOCKET_EVENTS.error, onError);
    return () => {
      socket.off(SOCKET_EVENTS.message, onMessage);
      socket.off(SOCKET_EVENTS.typingUpdate, onTyping);
      socket.off(SOCKET_EVENTS.presence, onPresence);
      socket.off(SOCKET_EVENTS.roomUnread, onUnread);
      socket.off(SOCKET_EVENTS.roomMembers, onRoomMembers);
      socket.off(SOCKET_EVENTS.error, onError);
    };
  }, [socket, activeRoom, user.id, t, markRead, reloadRooms, replaceOrAppendMessage]);

  useEffect(() => {
    if (status !== "polling" || !activeRoom) return;
    const interval = setInterval(async () => {
      const last = messagesRef.current[messagesRef.current.length - 1];
      try {
        const response = await apiFetch<MessagesResponse>(
          `/api/messages${toQueryString({
            roomId: activeRoom,
            since: last?.createdAt,
            afterId: last?.id,
            limit: MESSAGE_PAGE,
          })}`,
        );
        for (const message of response.data ?? []) replaceOrAppendMessage(message);
      } catch {
        // Retry on the next fallback tick.
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [status, activeRoom, replaceOrAppendMessage]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 160;
    if (nearBottom) list.scrollTop = list.scrollHeight;
  }, [messages, typingUsers]);

  useEffect(() => () => {
    for (const timer of typingTimersRef.current.values()) clearTimeout(timer);
  }, []);

  const active = rooms.find((room) => room.id === activeRoom) ?? null;
  const canUseSocket = status === "socket" && Boolean(socket?.connected);
  const canUseHttpFallback = status === "polling";
  const transportReady = canUseSocket || canUseHttpFallback;
  const typingLabel = useMemo(() => {
    const names = Array.from(typingUsers.values());
    if (names.length === 0) return null;
    return names.length === 1 ? t("chat.typing", { name: names[0] }) : t("chat.typing_plural");
  }, [typingUsers, t]);

  const send = async () => {
    const content = draft.trim();
    if (!content || !activeRoom || sending) return;
    if (!transportReady) {
      toast(t("chat.connection_wait"));
      return;
    }
    setSending(true);
    setDraft("");
    if (canUseSocket && socket) {
      queuedDraftRef.current = { roomId: activeRoom, content };
      socket.emit(SOCKET_EVENTS.sendMessage, { roomId: activeRoom, content }, (message) => {
        replaceOrAppendMessage(message);
        queuedDraftRef.current = null;
        setSending(false);
      });
      // If no acknowledgement frame arrives, restore the draft after a bounded wait.
      window.setTimeout(() => {
        if (queuedDraftRef.current?.content !== content || queuedDraftRef.current.roomId !== activeRoom) return;
        queuedDraftRef.current = null;
        setDraft((current) => current || content);
        setSending(false);
        toast.error(t("feedback.network"));
      }, 10_000);
      return;
    }
    try {
      const response = await apiFetch<MessagePayload>("/api/messages", {
        method: "POST",
        body: { roomId: activeRoom, content },
      });
      replaceOrAppendMessage(response);
      await markRead(activeRoom);
    } catch (caught) {
      setDraft(content);
      toast.error(caught instanceof ApiRequestError && caught.isRateLimited ? t("chat.rate_limited") : t("feedback.network"));
    } finally {
      setSending(false);
    }
  };

  const onDraftChange = (value: string) => {
    setDraft(value);
    if (!socket || !activeRoom || !canUseSocket) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current > TYPING_DEBOUNCE_MS) {
      lastTypingSentRef.current = now;
      socket.emit(SOCKET_EVENTS.typing, { roomId: activeRoom, typing: true });
    }
  };

  const loadOlder = async () => {
    if (!activeRoom || messages.length === 0) return;
    const list = listRef.current;
    const oldHeight = list?.scrollHeight ?? 0;
    await loadHistory(activeRoom, messages[0]).catch(() => undefined);
    requestAnimationFrame(() => {
      if (list && listRef.current === list) list.scrollTop += list.scrollHeight - oldHeight;
    });
  };

  const leaveGroup = async () => {
    if (!activeRoom || !active) return;
    try {
      await apiFetch(`/api/messages/rooms/${encodeURIComponent(activeRoom)}/members`, { method: "DELETE" });
      const remaining = rooms.filter((room) => room.id !== activeRoom);
      setRooms(remaining);
      selectRoom(remaining[0]?.id ?? null);
    } catch {
      toast.error(t("feedback.error.body"));
    }
  };

  return (
    <div className="flex h-[calc(100dvh-10rem)] min-h-[32rem] flex-col gap-4 lg:h-[calc(100dvh-9rem)]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] font-semibold tracking-[-0.015em]">{t("chat.title")}</h1>
          <p className="text-[14px] text-muted-foreground">{t("chat.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {onlineCount > 0 ? <Badge variant="success"><Users className="size-3" />{t("chat.online", { count: onlineCount })}</Badge> : null}
          <Button size="sm" onClick={() => setDialogMode("new")}><MessageSquarePlus />{t("chat.new_direct")}</Button>
        </div>
      </header>

      <Card className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[15rem_1fr]">
        <aside className="flex max-h-32 gap-1 overflow-x-auto border-b border-border/70 p-2 md:max-h-none md:flex-col md:overflow-y-auto md:overflow-x-hidden md:border-b-0 md:border-r">
          {loading ? <div className="p-3 text-sm text-muted-foreground">{t("common.loading")}</div> : null}
          {!loading && rooms.length === 0 ? <p className="p-3 text-sm text-muted-foreground">{t("chat.no_rooms")}</p> : null}
          {rooms.map((room) => (
            <button
              key={room.id}
              type="button"
              onClick={() => selectRoom(room.id)}
              aria-current={room.id === activeRoom ? "true" : undefined}
              className={cn(
                "flex min-w-40 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] font-medium transition-colors md:min-w-0",
                room.id === activeRoom ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
              )}
            >
              <MessagesSquare className="size-4 shrink-0 opacity-70" />
              <span className="min-w-0 flex-1 truncate">{room.name}</span>
              {room.unreadCount > 0 ? <Badge variant="primary" className="min-w-5 justify-center px-1">{room.unreadCount > 99 ? "99+" : room.unreadCount}</Badge> : null}
            </button>
          ))}
        </aside>

        <div className="flex min-h-0 flex-col">
          <header className="flex min-h-14 items-center justify-between gap-2 border-b border-border/70 px-4 py-2">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold">{active?.name ?? t("chat.rooms")}</h2>
              {active?.members?.length ? <p className="truncate text-xs text-muted-foreground">{t("chat.members")}: {active.members.map((member) => member.name).join(", ")}</p> : null}
            </div>
            {active?.type === "GROUP" ? (
              <div className="flex shrink-0 items-center gap-1">
                {active.members?.some((member) => member.userId === user.id && member.role === "ADMIN") ? (
                  <Button variant="ghost" size="sm" onClick={() => setDialogMode("add")}>{t("chat.add_member")}</Button>
                ) : null}
                <Button variant="ghost" size="sm" onClick={() => void leaveGroup()}>{t("chat.leave_group")}</Button>
              </div>
            ) : null}
          </header>

          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {loading ? <div className="flex h-full items-center justify-center"><Spinner /></div> : messages.length === 0 ? (
              <EmptyState icon={MessagesSquare} title={t("chat.empty.title")} description={t("chat.empty.body")} className="h-full justify-center border-0 bg-transparent" />
            ) : (
              <div className="flex flex-col gap-3">
                {hasMore ? <Button variant="ghost" size="sm" className="mx-auto gap-1.5 text-[12px]" onClick={() => void loadOlder()}><ArrowDownToLine className="size-3.5 rotate-180" />{t("chat.load_older")}</Button> : null}
                {messages.map((message) => {
                  const mine = message.sender.id === user.id;
                  return (
                    <div key={message.id} className={cn("group flex items-end gap-2.5", mine ? "flex-row-reverse" : "flex-row")}>
                      <Avatar className="size-7 shrink-0"><AvatarImage src={message.sender.image ?? undefined} alt="" /><AvatarFallback className="text-[10px]">{initials(message.sender.name)}</AvatarFallback></Avatar>
                      <div className={cn("flex max-w-[78%] flex-col gap-1", mine && "items-end")}>
                        {!mine ? <span className="px-1 text-[11.5px] font-medium text-muted-foreground">{message.sender.name}</span> : null}
                        <div className={cn("rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed", mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-surface-muted text-foreground", message.deleted && "italic text-muted-foreground")}>
                          {message.deleted ? t("chat.removed") : message.content}
                        </div>
                        <div className="flex items-center gap-1">
                          <time dateTime={message.createdAt} className="px-1 text-[10.5px] tabular-nums text-muted-foreground/70">{formatRelative(message.createdAt)}</time>
                          {!mine && !message.deleted ? <ReportContentButton targetType="message" targetId={message.id} signedIn label={t("chat.report_message")} compact /> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {typingLabel ? <div className="flex items-center gap-2 px-1 text-[12px] italic text-muted-foreground"><Loader2 className="size-3 animate-pulse" />{typingLabel}</div> : null}
              </div>
            )}
          </div>

          <form className="flex flex-col gap-2 border-t border-border/70 p-3" onSubmit={(event) => { event.preventDefault(); void send(); }}>
            {status === "connecting" || status === "offline" ? <p role="status" className="text-xs text-muted-foreground">{t("chat.connection_wait")}</p> : null}
            <div className="flex items-center gap-2">
              <Input value={draft} onChange={(event) => onDraftChange(event.target.value)} placeholder={t("chat.placeholder")} maxLength={2_000} aria-label={t("chat.placeholder")} disabled={!activeRoom} />
              <Button type="submit" size="icon" disabled={sending || !transportReady || draft.trim().length === 0 || !activeRoom} aria-label={t("chat.send")}>
                {sending ? <Spinner className="size-4" /> : <Send />}
              </Button>
            </div>
          </form>
        </div>
      </Card>

      <ChatConversationDialog
        open={dialogMode !== null}
        onOpenChange={(open) => setDialogMode(open ? (dialogMode ?? "new") : null)}
        currentRoom={dialogMode === "add" ? active ?? undefined : undefined}
        onCreated={(room) => {
          setRooms((current) => [room, ...current.filter((item) => item.id !== room.id)]);
          selectRoom(room.id);
        }}
        onMemberAdded={() => {
          void reloadRooms(activeRoom ?? undefined).catch(() => undefined);
        }}
      />
    </div>
  );
}
