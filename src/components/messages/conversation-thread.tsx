"use client";

import { ArrowLeft, ImagePlus, Loader2, LogOut, MoreVertical, Pencil, Phone, SendHorizontal, UserPlus, UsersRound, Video, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useCall } from "@/components/calls/call-provider";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useTranslation } from "@/components/providers/i18n-provider";
import { useRealtime } from "@/components/providers/realtime-provider";
import { UserAvatar } from "@/components/shell/user-avatar";
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/components/social/use-image-uploads";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { usePresence } from "@/hooks/use-presence";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { formatRelative } from "@/lib/format";
import type { MessagePayload } from "@/lib/socket/events";
import type { RoomDto, RoomMemberDto } from "@/modules/messages/messages.dto";

import { AddPeopleDialog } from "./new-conversation-dialog";
import { MessageBubble } from "./message-bubble";
import { useThread, type ThreadMessage } from "./use-thread";

/** For each other member, the newest message their read cursor has passed. */
function receiptsByMessage(messages: readonly ThreadMessage[], members: readonly RoomMemberDto[], viewerId: string) {
  const map = new Map<string, RoomMemberDto[]>();
  const settled = messages.filter((message) => !message.pending && !message.failed);
  for (const member of members) {
    if (member.userId === viewerId || !member.lastReadAt) continue;
    let target: ThreadMessage | undefined;
    for (const message of settled) {
      if (message.createdAt <= member.lastReadAt) target = message;
    }
    // Only show receipts on our own messages' side of the conversation end.
    if (target) map.set(target.id, [...(map.get(target.id) ?? []), member]);
  }
  return map;
}

export function ConversationThread({
  room,
  viewer,
  onBack,
  onLeft,
}: {
  readonly room: RoomDto;
  readonly viewer: { id: string; name: string; image: string | null };
  readonly onBack: () => void;
  readonly onLeft: () => void;
}) {
  const t = useTranslation();
  const { clearRoomUnread } = useRealtime();
  const thread = useThread(room.id, viewer);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<ThreadMessage | null>(null);
  const [confirmAll, setConfirmAll] = useState<ThreadMessage | null>(null);
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const input = useRef<HTMLTextAreaElement>(null);
  const peer = room.targetUser ?? null;
  const { startCall, state: callState } = useCall();
  const presence = usePresence(useMemo(() => (peer ? [peer.id] : []), [peer])).get(peer?.id ?? "");

  useEffect(() => clearRoomUnread(room.id), [room.id, clearRoomUnread, thread.messages.length]);

  // Follow new messages only if the reader is already at the bottom.
  useLayoutEffect(() => {
    const element = scroller.current;
    if (element && stickToBottom.current) element.scrollTop = element.scrollHeight;
  }, [thread.messages, thread.typing]);

  const receipts = useMemo(() => receiptsByMessage(thread.messages, thread.members, viewer.id), [thread.messages, thread.members, viewer.id]);

  // Delivery of my newest message: sending → sent → delivered (someone was
  // online or has been since) → seen (their read cursor passed it).
  const others = useMemo(() => thread.members.filter((member) => member.userId !== viewer.id), [thread.members, viewer.id]);
  const othersPresence = usePresence(useMemo(() => others.map((member) => member.userId), [others]));
  const lastMine = [...thread.messages].reverse().find((message) => message.sender.id === viewer.id && !message.deleted);
  const deliveryStatus = (() => {
    if (!lastMine || lastMine.failed) return null;
    if (lastMine.pending) return t("messages.status.sending");
    if (others.some((member) => member.lastReadAt && member.lastReadAt >= lastMine.createdAt)) return t("messages.status.seen");
    const delivered = others.some((member) => {
      const state = othersPresence.get(member.userId);
      return state?.online || (state?.lastSeenAt !== null && state?.lastSeenAt !== undefined && state.lastSeenAt >= lastMine.createdAt);
    });
    return delivered ? t("messages.status.delivered") : t("messages.status.sent");
  })();

  const submit = async () => {
    const content = draft.trim();
    if (editing) {
      if (!content) return;
      try {
        const response = await apiFetch<{ data: MessagePayload }>(`/api/messages/${encodeURIComponent(editing.id)}`, { method: "PATCH", body: { content } });
        thread.replaceMessage(response.data);
        setEditing(null);
        setDraft("");
      } catch (error) {
        toast.error(describeApiError(error, t));
      }
      return;
    }
    if (!content) return;
    setDraft("");
    stickToBottom.current = true;
    await thread.send(content);
  };

  const sendImage = async (file: File) => {
    if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type) || file.size > MAX_IMAGE_BYTES) {
      toast.error(t("composer.image_type"));
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("visibility", "PRIVATE");
      const response = await apiFetch<{ data: { id: string; url: string } }>("/api/upload", { method: "POST", body: form });
      stickToBottom.current = true;
      await thread.send(draft.trim(), response.data.id, response.data.url);
      setDraft("");
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setUploading(false);
    }
  };

  const deleteMessage = async (message: ThreadMessage, scope: "me" | "everyone") => {
    try {
      await apiFetch(`/api/messages/${encodeURIComponent(message.id)}?scope=${scope}`, { method: "DELETE" });
      if (scope === "me") thread.removeMessage(message.id);
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setConfirmAll(null);
    }
  };

  const leave = async () => {
    try {
      await apiFetch(`/api/messages/rooms/${encodeURIComponent(room.id)}/members`, { method: "DELETE" });
      onLeft();
    } catch (error) {
      toast.error(describeApiError(error, t));
    }
  };

  const typingNames = [...thread.typing.values()];
  const status = peer
    ? presence?.online
      ? t("messages.online")
      : presence?.lastSeenAt
        ? t("messages.last_seen", { time: formatRelative(presence.lastSeenAt) })
        : null
    : t("messages.members", { count: thread.members.length || room.members?.length || 0 });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-border/60 px-3 py-2.5">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack} aria-label={t("common.back")}>
          <ArrowLeft />
        </Button>
        {peer ? (
          <Link href={peer.username ? `/profile/${peer.username}` : "#"} className="flex min-w-0 items-center gap-3">
            <UserAvatar userId={peer.id} name={peer.name} image={peer.image} size="md" online={presence?.online ?? false} />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold">{room.name}</span>
              {status ? <span className={presence?.online ? "block text-[12px] text-success" : "block text-[12px] text-muted-foreground"}>{status}</span> : null}
            </span>
          </Link>
        ) : (
          <span className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-primary to-[oklch(0.62_0.2_310)] text-primary-foreground">
              <UsersRound className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold">{room.name}</span>
              <span className="block truncate text-[12px] text-muted-foreground">{thread.members.map((member) => member.name.split(" ")[0]).join(", ") || status}</span>
            </span>
          </span>
        )}
        {peer && room.type !== "GROUP" ? (
          <span className="ml-auto flex items-center gap-1">
            {(["audio", "video"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                aria-label={t(kind === "audio" ? "call.audio" : "call.video")}
                title={presence?.online ? t(kind === "audio" ? "call.audio" : "call.video") : t("call.offline")}
                disabled={callState.phase !== "idle"}
                onClick={() => {
                  if (!presence?.online) {
                    toast(t("call.offline"));
                    return;
                  }
                  void startCall(room.id, { id: peer.id, name: peer.name, image: peer.image }, kind);
                }}
                className="grid size-9 place-items-center rounded-full text-primary hover:bg-surface-muted disabled:opacity-50"
              >
                {kind === "audio" ? <Phone className="size-[18px]" /> : <Video className="size-5" />}
              </button>
            ))}
          </span>
        ) : null}
        {room.type === "GROUP" ? (
          <DropdownMenu>
            <DropdownMenuTrigger aria-label={t("common.more")} className="ml-auto grid size-9 place-items-center rounded-full hover:bg-surface-muted">
              <MoreVertical className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setAdding(true)}>
                <UserPlus />
                {t("messages.add_member")}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => void leave()}>
                <LogOut />
                {t("messages.leave")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </header>

      <div
        ref={scroller}
        onScroll={(event) => {
          const element = event.currentTarget;
          stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
          if (element.scrollTop < 60 && thread.hasMore && !thread.loadingOlder) {
            const before = element.scrollHeight;
            void thread.loadOlder().then(() => {
              requestAnimationFrame(() => {
                element.scrollTop = element.scrollHeight - before;
              });
            });
          }
        }}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4"
        aria-live="polite"
      >
        {thread.loadingOlder ? (
          <div className="flex justify-center pb-3">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : null}
        {thread.loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className={index % 2 ? "ml-auto h-10 w-1/2 rounded-2xl" : "h-10 w-2/3 rounded-2xl"} />
            ))}
          </div>
        ) : thread.error ? (
          <p className="py-8 text-center text-[13px] text-muted-foreground">{describeApiError(thread.error, t)}</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {thread.messages.map((message, index) => {
              const previous = thread.messages[index - 1];
              const next = thread.messages[index + 1];
              const mine = message.sender.id === viewer.id;
              const sameAsPrevious = previous?.sender.id === message.sender.id;
              const sameAsNext = next?.sender.id === message.sender.id;
              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  mine={mine}
                  showAuthor={room.type === "GROUP" && !sameAsPrevious}
                  showAvatar={!sameAsNext}
                  readers={receipts.get(message.id) ?? []}
                  status={message.id === lastMine?.id ? deliveryStatus : null}
                  onEdit={() => {
                    setEditing(message);
                    setDraft(message.content);
                    input.current?.focus();
                  }}
                  onDeleteForMe={() => void deleteMessage(message, "me")}
                  onDeleteForEveryone={() => setConfirmAll(message)}
                  onCopy={() => void navigator.clipboard.writeText(message.content).then(() => toast.success(t("messages.copied")))}
                  onDiscard={() => thread.discardFailed(message.id)}
                />
              );
            })}
            {typingNames.length > 0 ? (
              <p className="ml-11 flex items-center gap-2 text-[12.5px] italic text-muted-foreground">
                <span className="flex gap-0.5" aria-hidden>
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.2s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.1s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
                </span>
                {typingNames.length === 1 ? t("messages.typing", { name: typingNames[0] ?? "" }) : t("messages.typing_many")}
              </p>
            ) : null}
          </div>
        )}
      </div>

      <div className="border-t border-border/60 p-3">
        {editing ? (
          <div className="mb-2 flex items-center justify-between rounded-lg bg-accent px-3 py-1.5 text-[12.5px] text-accent-foreground">
            <span className="flex items-center gap-1.5">
              <Pencil className="size-3.5" /> {t("messages.editing")}
            </span>
            <button type="button" onClick={() => { setEditing(null); setDraft(""); }} aria-label={t("messages.cancel_edit")}>
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          {!editing ? (
            <Button variant="ghost" size="icon" onClick={() => fileInput.current?.click()} disabled={uploading} aria-label={t("messages.image")}>
              {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus className="text-success" />}
            </Button>
          ) : null}
          <textarea
            ref={input}
            value={draft}
            rows={1}
            maxLength={2000}
            onChange={(event) => {
              setDraft(event.target.value);
              thread.notifyTyping();
              event.target.style.height = "auto";
              event.target.style.height = `${Math.min(event.target.scrollHeight, 140)}px`;
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void submit();
              }
              if (event.key === "Escape" && editing) {
                setEditing(null);
                setDraft("");
              }
            }}
            placeholder={t("messages.placeholder")}
            aria-label={t("messages.placeholder")}
            className="min-h-10 flex-1 resize-none rounded-2xl bg-surface-muted px-4 py-2.5 text-[14.5px] leading-5 outline-none focus:ring-2 focus:ring-ring/25"
          />
          <Button size="icon" className="rounded-full" onClick={() => void submit()} aria-label={t("messages.send")} disabled={uploading}>
            <SendHorizontal />
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void sendImage(file);
              event.target.value = "";
            }}
          />
        </div>
      </div>

      <ConfirmDialog
        open={confirmAll !== null}
        onOpenChange={(open) => !open && setConfirmAll(null)}
        title={t("messages.delete_all")}
        description={t("messages.delete_all_confirm")}
        onConfirm={() => confirmAll && void deleteMessage(confirmAll, "everyone")}
      />
      {room.type === "GROUP" ? (
        <AddPeopleDialog
          open={adding}
          onOpenChange={setAdding}
          roomId={room.id}
          existing={thread.members.map((member) => member.userId)}
          onAdded={() => void thread.reloadMembers()}
        />
      ) : null}
    </div>
  );
}
