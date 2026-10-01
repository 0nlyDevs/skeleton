"use client";

import { ArrowDownToLine, Loader2, MessagesSquare, Send, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useSocket } from "@/hooks/use-socket";

import { useRealtime } from "@/components/providers/realtime-provider";
import { useTranslation } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/feedback/empty-state";
import { ChatSkeleton } from "@/components/feedback/loading-skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch, ApiRequestError, toQueryString } from "@/lib/api/client";
import { formatRelative } from "@/lib/format";
import { SOCKET_EVENTS, type MessagePayload } from "@/lib/socket/events";
import { cn, initials } from "@/lib/utils";
import type { AuthUser } from "@/types";

interface RoomDto {
  readonly id: string;
  readonly name: string;
  readonly type: string;
}

interface MessagesResponse {
  readonly data: MessagePayload[];
  readonly meta: { readonly hasMore: boolean };
}

const MESSAGE_PAGE = 30;
const POLL_INTERVAL_MS = 8_000;
const TYPING_DEBOUNCE_MS = 2_500;

/**
 * Chat.
 *
 * Transport strategy, in one place:
 *
 *  * **Socket connected** — sends ride `message:send` and arrivals come back on
 *    `message:new`. Typing and presence are socket-only (they are ephemeral and
 *    worthless over HTTP).
 *  * **Polling fallback** — when the socket is degraded, sends go through
 *    `POST /api/messages` and the list refetches `?since=<lastId>` every few
 *    seconds. The indicator in the topbar already tells the user which mode is
 *    active; the composer behaves identically in both.
 *
 * Rendering safety: message content is rendered as a text node, never as HTML.
 * React escapes it — which is precisely why there is no `dangerouslySetInnerHTML`
 * anywhere in this file.
 */
export function ChatView({ user }: { readonly user: AuthUser }) {
  const t = useTranslation();
  const { status } = useRealtime();

  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessagePayload[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());

  const listRef = useRef<HTMLDivElement>(null);
  const lastTypingSentRef = useRef(0);
  const typingTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // --- Rooms ------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const loadRooms = async () => {
      try {
        const response = await apiFetch<{ data: RoomDto[] }>("/api/messages/rooms");
        if (cancelled) return;
        setRooms(response.data);
        setActiveRoom((current) => current ?? response.data[0]?.id ?? null);
      } catch {
        if (!cancelled) setLoading(false);
      }
    };

    void loadRooms();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- History --------------------------------------------------------------
  const loadHistory = useCallback(
    async (roomId: string, before?: string) => {
      const response = await apiFetch<MessagesResponse>(
        `/api/messages${toQueryString({ roomId, limit: MESSAGE_PAGE, ...(before ? { before } : {}) })}`,
      );
      setHasMore(response.meta.hasMore);
      setMessages((current) =>
        before ? [...response.data.reverse(), ...current] : response.data,
      );
    },
    [],
  );

  useEffect(() => {
    if (!activeRoom) return;
    let cancelled = false;

    setLoading(true);
    setMessages([]);
    void loadHistory(activeRoom)
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeRoom, loadHistory]);

  // --- Socket wiring ---------------------------------------------------------
  const socket = useSocketConnection(activeRoom);

  useEffect(() => {
    if (!socket) return;

    const onMessage = (payload: MessagePayload) => {
      if (payload.roomId !== activeRoom) return;
      setMessages((current) =>
        current.some((message) => message.id === payload.id)
          ? current
          : [...current, payload],
      );
      // An arrival clears the sender's typing state immediately.
      setTypingUsers((current) => {
        if (!current.has(payload.sender.id)) return current;
        const next = new Map(current);
        next.delete(payload.sender.id);
        return next;
      });
    };

    const onTyping = (payload: { roomId: string; userId: string; name: string; typing: boolean }) => {
      if (payload.roomId !== activeRoom || payload.userId === user.id) return;

      setTypingUsers((current) => {
        const next = new Map(current);
        if (payload.typing) next.set(payload.userId, payload.name);
        else next.delete(payload.userId);
        return next;
      });

      // Safety net: a lost "stopped" frame must not leave a ghost indicator.
      const timers = typingTimersRef.current;
      const existing = timers.get(payload.userId);
      if (existing) clearTimeout(existing);
      if (payload.typing) {
        timers.set(
          payload.userId,
          setTimeout(() => {
            setTypingUsers((current) => {
              const next = new Map(current);
              next.delete(payload.userId);
              return next;
            });
          }, 6_000),
        );
      }
    };

    const onPresence = (payload: { roomId: string; online: number }) => {
      if (payload.roomId === activeRoom) setOnlineCount(payload.online);
    };

    // The server rejects socket events (rate limit, forbidden room, invalid
    // payload) with an error frame instead of dropping the connection. Without
    // this listener those failures are silent: the message simply never
    // appears. Codes are localized, the raw message is only a fallback.
    const onError = (payload: { code: string; message: string }) => {
      if (payload.code === "RATE_LIMITED") {
        toast.error(t("chat.rate_limited"));
        return;
      }
      if (payload.code === "FORBIDDEN") {
        toast.error(t("feedback.forbidden.body"));
        return;
      }
      if (payload.code === "UNAUTHENTICATED") {
        toast.error(t("feedback.network"));
        return;
      }
      toast.error(payload.message || t("feedback.error.title"));
    };

    socket.on(SOCKET_EVENTS.message, onMessage);
    socket.on(SOCKET_EVENTS.typingUpdate, onTyping);
    socket.on(SOCKET_EVENTS.presence, onPresence);
    socket.on(SOCKET_EVENTS.error, onError);

    return () => {
      socket.off(SOCKET_EVENTS.message, onMessage);
      socket.off(SOCKET_EVENTS.typingUpdate, onTyping);
      socket.off(SOCKET_EVENTS.presence, onPresence);
      socket.off(SOCKET_EVENTS.error, onError);
    };
  }, [socket, activeRoom, user.id, t]);

  // --- Polling fallback ------------------------------------------------------
  useEffect(() => {
    // Socket first: the HTTP API is only polled once the socket has failed
    // repeatedly, never while it is merely (re)connecting.
    if (status !== "polling" || !activeRoom) return;

    const interval = setInterval(async () => {
      const lastId = messages[messages.length - 1]?.id;
      try {
        const response = await apiFetch<MessagesResponse>(
          `/api/messages${toQueryString({ roomId: activeRoom, since: lastId, limit: MESSAGE_PAGE })}`,
        );
        if (response.data.length > 0) {
          setMessages((current) => {
            const known = new Set(current.map((message) => message.id));
            return [...current, ...response.data.filter((message) => !known.has(message.id))];
          });
        }
      } catch {
        // Transient polling failures are silent: the next tick retries.
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [status, activeRoom, messages]);

  // --- Actions ---------------------------------------------------------------
  const send = useCallback(async () => {
    const content = draft.trim();
    if (!content || !activeRoom || sending) return;

    // 1 msg/s, enforced server-side; the client mirrors it so the toast is rare.
    setSending(true);
    setDraft("");

    try {
      if (socket) {
        socket.emit(SOCKET_EVENTS.sendMessage, { roomId: activeRoom, content });
      } else {
        await apiFetch("/api/messages", {
          method: "POST",
          body: { roomId: activeRoom, content },
        });
      }
    } catch (caught) {
      setDraft(content);
      toast.error(
        caught instanceof ApiRequestError && caught.isRateLimited
          ? t("chat.rate_limited")
          : t("feedback.network"),
      );
    } finally {
      // Brief cooldown that also communicates the rate limit non-verbally.
      setTimeout(() => setSending(false), 900);
    }
  }, [draft, activeRoom, sending, socket, t]);

  const onDraftChange = (value: string) => {
    setDraft(value);

    if (!socket || !activeRoom) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current > TYPING_DEBOUNCE_MS) {
      lastTypingSentRef.current = now;
      socket.emit(SOCKET_EVENTS.typing, { roomId: activeRoom, typing: true });
    }
  };

  const loadOlder = async () => {
    if (!activeRoom || messages.length === 0) return;
    try {
      await loadHistory(activeRoom, messages[0].id);
    } catch {
      // keep the list as-is
    }
  };

  // Auto-scroll when the last message changes and the user is near the bottom.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 160;
    if (nearBottom) list.scrollTop = list.scrollHeight;
  }, [messages, typingUsers]);

  const _activeRoomName = useMemo(
    () => rooms.find((room) => room.id === activeRoom)?.name ?? "",
    [rooms, activeRoom],
  );

  const typingLabel = useMemo(() => {
    const names = Array.from(typingUsers.values());
    if (names.length === 0) return null;
    if (names.length === 1) return t("chat.typing", { name: names[0] });
    return t("chat.typing_plural");
  }, [typingUsers, t]);

  return (
    <div className="flex h-[calc(100dvh-10rem)] min-h-[28rem] flex-col gap-4 lg:h-[calc(100dvh-9rem)]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] font-semibold tracking-[-0.015em]">{t("chat.title")}</h1>
          <p className="text-[14px] text-muted-foreground">{t("chat.subtitle")}</p>
        </div>
        {onlineCount > 0 ? (
          <Badge variant="success">
            <Users className="size-3" />
            {t("chat.online", { count: onlineCount })}
          </Badge>
        ) : null}
      </header>

      <Card className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[14rem_1fr]">
        {/* Rooms */}
        <aside className="hidden min-h-0 flex-col gap-1 overflow-y-auto border-r border-border/70 p-2 md:flex">
          {rooms.map((room) => (
            <button
              key={room.id}
              type="button"
              onClick={() => setActiveRoom(room.id)}
              aria-current={room.id === activeRoom ? "true" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] font-medium transition-colors",
                room.id === activeRoom
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
              )}
            >
              <MessagesSquare className="size-4 shrink-0 opacity-70" />
              <span className="truncate">{room.name}</span>
            </button>
          ))}
        </aside>

        {/* Messages + composer */}
        <div className="flex min-h-0 flex-col">
          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {loading ? (
              <ChatSkeleton rows={5} />
            ) : messages.length === 0 ? (
              <EmptyState
                icon={MessagesSquare}
                title={t("chat.empty.title")}
                description={t("chat.empty.body")}
                className="h-full justify-center border-0 bg-transparent"
              />
            ) : (
              <div className="flex flex-col gap-3">
                {hasMore ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mx-auto gap-1.5 text-[12px]"
                    onClick={() => void loadOlder()}
                  >
                    <ArrowDownToLine className="size-3.5 rotate-180" />
                    {t("chat.load_older")}
                  </Button>
                ) : null}

                {messages.map((message) => {
                  const mine = message.sender.id === user.id;
                  return (
                    <div
                      key={message.id}
                      className={cn("flex items-end gap-2.5", mine ? "flex-row-reverse" : "flex-row")}
                    >
                      <Avatar className="size-7 shrink-0">
                        {message.sender.image ? (
                          <AvatarImage src={message.sender.image} alt="" />
                        ) : null}
                        <AvatarFallback className="text-[10px]">
                          {initials(message.sender.name)}
                        </AvatarFallback>
                      </Avatar>

                      <div className={cn("flex max-w-[78%] flex-col gap-1", mine && "items-end")}>
                        {!mine ? (
                          <span className="px-1 text-[11.5px] font-medium text-muted-foreground">
                            {message.sender.name}
                          </span>
                        ) : null}
                        <div
                          className={cn(
                            "rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed",
                            mine
                              ? "rounded-br-md bg-primary text-primary-foreground"
                              : "rounded-bl-md bg-surface-muted text-foreground",
                          )}
                        >
                          {/* Text node only — user content is never interpreted. */}
                          {message.content}
                        </div>
                        <time
                          dateTime={message.createdAt}
                          className="px-1 text-[10.5px] tabular-nums text-muted-foreground/70"
                        >
                          {formatRelative(message.createdAt)}
                        </time>
                      </div>
                    </div>
                  );
                })}

                {typingLabel ? (
                  <div className="flex items-center gap-2 px-1 text-[12px] italic text-muted-foreground">
                    <Loader2 className="size-3 animate-pulse" />
                    {typingLabel}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <form
            className="flex items-center gap-2 border-t border-border/70 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <Input
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              placeholder={t("chat.placeholder")}
              maxLength={2_000}
              aria-label={t("chat.placeholder")}
            />
            <Button type="submit" size="icon" disabled={sending || draft.trim().length === 0} aria-label={t("chat.send")}>
              {sending ? <Spinner className="size-4" /> : <Send />}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}

/**
 * Joins the active room for the lifetime of this view.
 *
 * Room membership is intentionally separate from the message handlers above: the
 * handlers re-bind when handlers change, but re-joining the room must not happen
 * just because a callback identity moved. Returns the shared socket instance.
 */
function useSocketConnection(activeRoom: string | null) {
  const { socket, status } = useSocket();

  useEffect(() => {
    if (!socket || !activeRoom || status !== "socket") return;

    socket.emit(SOCKET_EVENTS.joinRoom, activeRoom);
    return () => {
      socket.emit(SOCKET_EVENTS.leaveRoom, activeRoom);
    };
  }, [socket, activeRoom, status]);

  return socket;
}
