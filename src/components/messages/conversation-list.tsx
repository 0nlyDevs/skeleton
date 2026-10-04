"use client";

import { PenSquare, Search, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { useFormatters } from "@/hooks/use-formatters";
import { useRealtime } from "@/components/providers/realtime-provider";
import { UserAvatar } from "@/components/shell/user-avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePresence } from "@/hooks/use-presence";
import { matchesSearch } from "@/lib/search";
import { cn } from "@/lib/utils";
import type { RoomDto } from "@/modules/messages/messages.dto";

export function ConversationList({
  rooms,
  activeId,
  viewerId,
  onSelect,
  onNew,
  onNewGroup,
  typingRooms,
}: {
  readonly rooms: readonly RoomDto[] | null;
  readonly activeId: string | null;
  readonly viewerId: string;
  readonly onSelect: (roomId: string) => void;
  readonly onNew: () => void;
  readonly onNewGroup: () => void;
  readonly typingRooms?: ReadonlyMap<string, string>;
}) {
  const t = useTranslation();
  const fmt = useFormatters();
  const { messageUnread } = useRealtime();
  const [q, setQ] = useState("");
  const peers = useMemo(() => (rooms ?? []).flatMap((room) => (room.targetUser ? [room.targetUser.id] : [])), [rooms]);
  const presence = usePresence(peers);

  const visible = (rooms ?? []).filter((room) => matchesSearch([room.name], q));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <h1 className="text-[1.25rem] font-bold tracking-tight">{t("messages.title")}</h1>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={onNewGroup} aria-label={t("messages.new_group")} title={t("messages.new_group")}>
            <UsersRound />
          </Button>
          <Button variant="ghost" size="icon" onClick={onNew} aria-label={t("messages.new")} title={t("messages.new")}>
            <PenSquare />
          </Button>
        </div>
      </div>
      <label className="relative mx-4 mt-3 block">
        <span className="sr-only">{t("messages.search")}</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder={t("messages.search")}
          className="h-10 w-full rounded-full bg-surface-muted pl-9 pr-3 text-[0.8438rem] outline-none focus:ring-2 focus:ring-ring/25"
        />
      </label>

      <ul className="mt-2 min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {rooms === null ? (
          [0, 1, 2, 3, 4].map((index) => <Skeleton key={index} className="mx-2 my-2 h-14 rounded-xl" />)
        ) : visible.length === 0 ? (
          <li className="px-4 py-8 text-center">
            <p className="text-[0.875rem] font-semibold">{t("messages.empty_title")}</p>
            <p className="mt-1 text-[0.8125rem] text-muted-foreground">{t("messages.empty_body")}</p>
            <Button className="mt-3" size="sm" onClick={onNew}>
              {t("messages.new")}
            </Button>
          </li>
        ) : (
          visible.map((room) => {
            const unread = messageUnread[room.id] ?? 0;
            const last = room.lastMessage;
            const mine = last?.senderId === viewerId;
            const text = !last
              ? ""
              : last.deleted
                ? t("messages.deleted")
                : last.systemKind
                  ? {
                      MEMBER_JOINED: t("messages.system.member_joined", { name: last.senderName }),
                      MEMBER_LEFT: t("messages.system.member_left", { name: last.senderName }),
                      MEMBER_REMOVED: t("messages.system.member_removed", { name: last.senderName }),
                    }[last.systemKind] ?? last.content
                  : `${mine ? `${t("messages.you")}: ` : room.type === "GROUP" ? `${last.senderName.split(" ")[0]}: ` : ""}${last.content || (last.hasImage ? t("messages.photo") : "")}`;
            const peer = room.targetUser;
            return (
              <li key={room.id}>
                <button
                  type="button"
                  onClick={() => onSelect(room.id)}
                  aria-current={room.id === activeId ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors",
                    room.id === activeId ? "bg-accent" : "hover:bg-surface-muted",
                  )}
                >
                  {peer ? (
                    <UserAvatar userId={peer.id} name={peer.name} image={peer.image} size="md" online={presence.get(peer.id)?.online ?? false} />
                  ) : room.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- group photo (public upload)
                    <img src={room.image} alt="" className="size-10 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-[oklch(0.62_0.2_310)] text-primary-foreground">
                      <UsersRound className="size-5" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn("truncate text-[0.875rem]", unread > 0 ? "font-bold" : "font-medium")}>{room.name}</span>
                      {last ? <span className="shrink-0 text-[0.6875rem] text-muted-foreground">{fmt.relative(last.createdAt)}</span> : null}
                    </span>
                    <span className="flex items-center gap-2">
                      {typingRooms?.has(room.id) ? (
                        <span className="flex items-center gap-1 truncate text-[0.7812rem] font-medium text-primary">
                          <span className="flex gap-0.5" aria-hidden>
                            <span className="size-1 animate-bounce rounded-full bg-primary [animation-delay:-0.2s]" />
                            <span className="size-1 animate-bounce rounded-full bg-primary [animation-delay:-0.1s]" />
                            <span className="size-1 animate-bounce rounded-full bg-primary" />
                          </span>
                          {room.type === "GROUP" ? `${typingRooms.get(room.id)?.split(" ")[0] ?? ""} ` : ""}
                          {t("messages.list_typing")}
                        </span>
                      ) : (
                        <span className={cn("truncate text-[0.7812rem]", unread > 0 ? "font-semibold text-foreground" : "text-muted-foreground")}>{text}</span>
                      )}
                      {unread > 0 ? (
                        <span className="ml-auto grid min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[0.6875rem] font-bold leading-5 text-primary-foreground">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
