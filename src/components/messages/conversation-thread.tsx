"use client";

import { ArrowLeft, ImagePlus, Loader2, LogOut, MoreVertical, Pencil, Phone, SendHorizontal, Trash2, UserPlus, UsersRound, Video, X } from "lucide-react";
import Link from "@/components/ui/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useCall } from "@/components/calls/call-provider";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useTranslation } from "@/components/providers/i18n-provider";
import { useFormatters } from "@/hooks/use-formatters";
import { useRealtime } from "@/components/providers/realtime-provider";
import { UserAvatar } from "@/components/shell/user-avatar";
import { IMAGE_INPUT_ACCEPT, describeImageError, uploadImage } from "@/components/social/use-image-uploads";
import { imagesFromClipboard } from "@/lib/images/prepare-image";
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
import type { MessagePayload } from "@/lib/socket/events";
import { cn } from "@/lib/utils";
import type { MessageReplyDto, RoomDto, RoomMemberDto } from "@/modules/messages/messages.dto";

import { EditGroupDialog } from "./edit-group-dialog";
import { ManageGroupMembersDialog } from "./manage-group-members-dialog";
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
  const fmt = useFormatters();
  const { clearRoomUnread } = useRealtime();
  const thread = useThread(room.id, viewer);
  const isGroupAdmin = room.type === "GROUP" && thread.members.some((member) => member.userId === viewer.id && member.role === "ADMIN");
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<ThreadMessage | null>(null);
  const [confirmAll, setConfirmAll] = useState<ThreadMessage | null>(null);
  const [adding, setAdding] = useState(false);
  const [managingMembers, setManagingMembers] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<MessageReplyDto | null>(null);
  const [confirmClear, setConfirmClear] = useState<"me" | "everyone" | null>(null);
  const [editingGroup, setEditingGroup] = useState(false);
  const [attachment, setAttachment] = useState<{ previewUrl: string; upload: Promise<{ id: string; url: string }>; failed: boolean } | null>(null);
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
    if (attachment) {
      if (attachment.failed) {
        toast.error(t("messages.image_failed"));
        return;
      }
      const staged = attachment;
      setDraft("");
      setAttachment(null);
      stickToBottom.current = true;
      try {
        const uploaded = await staged.upload;
        const reply = replyingTo;
        setReplyingTo(null);
        await thread.send(content, uploaded.id, staged.previewUrl, reply);
      } catch {
        // The upload error was already shown when it happened.
      }
      return;
    }
    if (!content) return;
    setDraft("");
    stickToBottom.current = true;
    const reply = replyingTo;
    setReplyingTo(null);
    await thread.send(content, undefined, undefined, reply);
  };

  const clearConversation = async (scope: "me" | "everyone") => {
    try {
      await apiFetch(`/api/messages/rooms/${encodeURIComponent(room.id)}?scope=${scope}`, { method: "DELETE" });
      toast.success(t(scope === "me" ? "messages.conversation_deleted" : "messages.group_deleted"));
      onLeft?.();
    } catch (error) {
      toast.error(describeApiError(error, t));
    }
  };

  /*
   * A picked or pasted image is staged above the input with a preview: it
   * uploads in the background and leaves with the text when Send is pressed.
   */
  const stageImage = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error(t("composer.image_type"));
      return;
    }
    if (attachment) URL.revokeObjectURL(attachment.previewUrl);
    const previewUrl = URL.createObjectURL(file);
    const upload = uploadImage(file);
    setAttachment({ previewUrl, upload, failed: false });
    setUploading(true);
    upload
      .catch((error: unknown) => {
        toast.error(describeImageError(error, t));
        setAttachment((current) => (current?.upload === upload ? { ...current, failed: true } : current));
      })
      .finally(() => setUploading(false));
    input.current?.focus();
  };

  const clearAttachment = () => {
    if (attachment) URL.revokeObjectURL(attachment.previewUrl);
    setAttachment(null);
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
        ? t("messages.last_seen", { time: fmt.relative(presence.lastSeenAt) })
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
              <span className="block truncate text-[0.9375rem] font-semibold">{room.name}</span>
              {status ? <span className={presence?.online ? "block text-[0.75rem] text-success" : "block text-[0.75rem] text-muted-foreground"}>{status}</span> : null}
            </span>
          </Link>
        ) : (
          <span className="flex min-w-0 items-center gap-3">
            {room.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- group photo (public upload)
              <img src={room.image} alt="" className="size-10 rounded-full object-cover" />
            ) : (
            <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-primary to-[oklch(0.62_0.2_310)] text-primary-foreground">
              <UsersRound className="size-5" />
            </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-[0.9375rem] font-semibold">{room.name}</span>
              <span className="block truncate text-[0.75rem] text-muted-foreground">{thread.members.map((member) => member.name.split(" ")[0]).join(", ") || status}</span>
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
                title={t(kind === "audio" ? "call.audio" : "call.video")}
                disabled={callState.phase !== "idle"}
                onClick={() => {
                  void startCall(room.id, { id: peer.id, name: peer.name, image: peer.image }, kind);
                }}
                className="grid size-9 place-items-center rounded-full text-primary hover:bg-surface-muted disabled:opacity-50"
              >
                {kind === "audio" ? <Phone className="size-[18px]" /> : <Video className="size-5" />}
              </button>
            ))}
          </span>
        ) : null}
        {room.type === "GROUP" || room.type === "DIRECT" ? (
          <DropdownMenu>
            <DropdownMenuTrigger aria-label={t("common.more")} className={cn("grid size-9 place-items-center rounded-full hover:bg-surface-muted", room.type === "GROUP" && "ml-auto")}>
              <MoreVertical className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {room.type === "GROUP" ? (
                <>
                  <DropdownMenuItem onSelect={() => setAdding(true)}>
                    <UserPlus />
                    {t("messages.add_member")}
                  </DropdownMenuItem>
                  {isGroupAdmin ? (
                    <>
                      <DropdownMenuItem onSelect={() => setEditingGroup(true)}>
                        <Pencil />
                        {t("messages.edit_group")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setManagingMembers(true)}>
                        <UsersRound />
                        {t("messages.manage_members")}
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </>
              ) : null}
              <DropdownMenuItem onSelect={() => setConfirmClear("me")}>
                <Trash2 />
                {t("messages.delete_conversation")}
              </DropdownMenuItem>
              {room.type === "GROUP" ? (
                <>
                  <DropdownMenuItem variant="destructive" onSelect={() => void leave()}>
                    <LogOut />
                    {t("messages.leave")}
                  </DropdownMenuItem>
                  {isGroupAdmin ? (
                    <DropdownMenuItem variant="destructive" onSelect={() => setConfirmClear("everyone")}>
                      <Trash2 />
                      {t("messages.delete_group")}
                    </DropdownMenuItem>
                  ) : null}
                </>
              ) : null}
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
          <p className="py-8 text-center text-[0.8125rem] text-muted-foreground">{describeApiError(thread.error, t)}</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {thread.messages.map((message, index) => {
              const previous = thread.messages[index - 1];
              const next = thread.messages[index + 1];
              const isSystem = Boolean(message.systemKind);
              const mine = message.sender.id === viewer.id;
              const sameAsPrevious = previous?.sender.id === message.sender.id;
              const sameAsNext = next?.sender.id === message.sender.id;
              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  mine={mine}
                  showAuthor={room.type === "GROUP" && !sameAsPrevious && !isSystem}
                  showAvatar={!sameAsNext && !isSystem}
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
                  viewerId={viewer.id}
                  onReacted={thread.replaceMessage}
                  onReply={() => {
                    setEditing(null);
                    setReplyingTo({
                      id: message.id,
                      senderName: message.sender.name,
                      preview: message.content.slice(0, 140),
                      hasImage: message.image !== null,
                      deleted: false,
                    });
                    input.current?.focus();
                  }}
                  onJumpTo={(messageId) => {
                    const target = scroller.current?.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
                    if (!target) return;
                    target.scrollIntoView({ behavior: "smooth", block: "center" });
                    target.classList.add("bg-primary/10");
                    setTimeout(() => target.classList.remove("bg-primary/10"), 1_200);
                  }}
                />
              );
            })}
            {typingNames.length > 0 ? (
              <p className="ml-11 flex items-center gap-2 text-[0.7812rem] italic text-muted-foreground">
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
          <div className="mb-2 flex items-center justify-between rounded-lg bg-accent px-3 py-1.5 text-[0.7812rem] text-accent-foreground">
            <span className="flex items-center gap-1.5">
              <Pencil className="size-3.5" /> {t("messages.editing")}
            </span>
            <button type="button" onClick={() => { setEditing(null); setDraft(""); }} aria-label={t("messages.cancel_edit")}>
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}
        {replyingTo && !editing ? (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border-l-2 border-primary bg-accent px-3 py-1.5 text-[0.7812rem] text-accent-foreground">
            <span className="min-w-0">
              <span className="block font-semibold">{t("messages.replying_to", { name: replyingTo.senderName })}</span>
              <span className="block truncate opacity-80">{replyingTo.preview || (replyingTo.hasImage ? t("messages.photo") : "")}</span>
            </span>
            <button type="button" onClick={() => setReplyingTo(null)} aria-label={t("comments.cancel_reply")}>
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}
        {attachment && !editing ? (
          <div className="mb-2 flex items-center gap-2">
            <div className="relative size-16 overflow-hidden rounded-xl bg-surface-muted">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the staged image */}
              <img src={attachment.previewUrl} alt={t("messages.image")} className="size-full object-cover" />
              {uploading ? (
                <span className="absolute inset-0 grid place-items-center bg-black/30">
                  <Loader2 className="size-5 animate-spin text-white" />
                </span>
              ) : null}
              <button
                type="button"
                onClick={clearAttachment}
                aria-label={t("composer.remove_image")}
                className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black/60 text-white"
              >
                <X className="size-3" />
              </button>
            </div>
            <span className="text-[0.75rem] text-muted-foreground">{attachment.failed ? t("messages.image_failed") : t("messages.image_ready")}</span>
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
            onPaste={(event) => {
              // A pasted screenshot or copied image is sent like a picked one.
              const [image] = imagesFromClipboard(event);
              if (image && !editing) {
                event.preventDefault();
                stageImage(image);
              }
            }}
            placeholder={t("messages.placeholder")}
            aria-label={t("messages.placeholder")}
            className="min-h-10 flex-1 resize-none rounded-2xl bg-surface-muted px-4 py-2.5 text-[0.9062rem] leading-5 outline-none focus:ring-2 focus:ring-ring/25"
          />
          <Button size="icon" className="rounded-full" onClick={() => void submit()} aria-label={t("messages.send")}>
            <SendHorizontal />
          </Button>
          <input
            ref={fileInput}
            type="file"
          aria-label={t("tn.a11y.choose_file")}
            accept={IMAGE_INPUT_ACCEPT}
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) stageImage(file);
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
      <ConfirmDialog
        open={confirmClear !== null}
        onOpenChange={(open) => !open && setConfirmClear(null)}
        title={t(confirmClear === "everyone" ? "messages.delete_group" : "messages.delete_conversation")}
        description={t(confirmClear === "everyone" ? "messages.delete_group_confirm" : "messages.delete_conversation_confirm")}
        onConfirm={() => confirmClear && void clearConversation(confirmClear)}
      />
      {isGroupAdmin ? <EditGroupDialog room={room} open={editingGroup} onOpenChange={setEditingGroup} /> : null}
      {room.type === "GROUP" ? (
        <AddPeopleDialog
          open={adding}
          onOpenChange={setAdding}
          roomId={room.id}
          existing={thread.members.map((member) => member.userId)}
          onAdded={() => void thread.reloadMembers()}
        />
      ) : null}
      {room.type === "GROUP" ? (
        <ManageGroupMembersDialog
          open={managingMembers}
          onOpenChange={setManagingMembers}
          roomId={room.id}
          members={thread.members}
          viewerId={viewer.id}
          onRemoved={() => void thread.reloadMembers()}
        />
      ) : null}
    </div>
  );
}
