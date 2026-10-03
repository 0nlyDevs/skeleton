"use client";

import { AlertCircle, Copy, CornerUpLeft, MoreHorizontal, Pencil, SmilePlus, Trash2, Undo2 } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { useFormatters } from "@/hooks/use-formatters";
import { UserAvatar } from "@/components/shell/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ReactorsDialog } from "@/components/social/reactors-dialog";
import { REACTION_EMOJI, REACTION_LABEL } from "@/components/social/reactions";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import type { MessageDto } from "@/modules/messages/messages.dto";
import { REACTION_TYPES, type ReactionType } from "@/types";
import type { RoomMemberDto } from "@/modules/messages/messages.dto";

import { PostLinkPreview, sharedPostId } from "./post-link-preview";
import type { ThreadMessage } from "./use-thread";

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * One message. Own messages sit on the right; consecutive messages from the
 * same person are grouped (avatar and name once). Read receipts — the small
 * avatars of people whose read cursor stops here — render underneath.
 */
export function MessageBubble({
  message,
  mine,
  showAuthor,
  showAvatar,
  readers,
  status,
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
  onCopy,
  onDiscard,
  viewerId,
  onReacted,
  onReply,
  onJumpTo,
}: {
  readonly message: ThreadMessage;
  readonly mine: boolean;
  readonly showAuthor: boolean;
  readonly showAvatar: boolean;
  readonly readers: readonly RoomMemberDto[];
  /** Delivery state, shown under the newest of one's own messages only. */
  readonly status?: string | null;
  readonly onEdit: () => void;
  readonly onDeleteForMe: () => void;
  readonly onDeleteForEveryone: () => void;
  readonly onCopy: () => void;
  readonly onDiscard: () => void;
  /** The viewer, to highlight their own reaction. */
  readonly viewerId: string;
  /** The server's updated message (also pushed to the room over the socket). */
  readonly onReacted: (message: MessageDto) => void;
  /** Start a reply to this message. */
  readonly onReply: () => void;
  /** Scroll to a quoted message, when it is loaded. */
  readonly onJumpTo: (messageId: string) => void;
}) {
  const t = useTranslation();
  const fmt = useFormatters();
  // Captured once per mount: the 24-hour window is a hint, the server enforces it.
  const [mountedAt] = useState(() => Date.now());
  const [picker, setPicker] = useState(false);
  const [reactorsOpen, setReactorsOpen] = useState(false);
  const mineReaction = message.reactions.find((entry) => entry.userIds.includes(viewerId))?.type ?? null;
  const canReact = !message.deleted && !message.pending && !message.failed;

  const react = async (type: ReactionType | null) => {
    setPicker(false);
    try {
      const response = await apiFetch<{ data: MessageDto }>(`/api/messages/${encodeURIComponent(message.id)}/reaction`, type ? { method: "PUT", body: { type } } : { method: "DELETE" });
      onReacted(response.data);
    } catch (error) {
      toast.error(describeApiError(error, t));
    }
  };
  const loadReactors = useCallback(async () => {
    const response = await apiFetch<{ data: { type: ReactionType; user: { id: string; name: string; username: string | null; image: string | null } }[] }>(
      `/api/messages/${encodeURIComponent(message.id)}/reaction`,
    );
    return response.data.map((row) => ({ emoji: REACTION_EMOJI[row.type], user: row.user }));
  }, [message.id]);

  const editable = mine && !message.deleted && !message.pending && !message.failed && mountedAt - Date.parse(message.createdAt) < EDIT_WINDOW_MS;

  return (
    <div data-message-id={message.id} className={cn("group flex scroll-mt-24 flex-col rounded-xl transition-colors", mine ? "items-end" : "items-start")}>
      {showAuthor && !mine ? <span className="mb-0.5 ml-11 text-[0.7188rem] font-medium text-muted-foreground">{message.sender.name}</span> : null}
      <div className={cn("flex max-w-[85%] items-end gap-2 sm:max-w-[70%]", mine && "flex-row-reverse")}>
        {!mine ? (
          <span className="w-9 shrink-0">{showAvatar ? <UserAvatar userId={message.sender.id} name={message.sender.name} image={message.sender.image} size="sm" /> : null}</span>
        ) : null}

        <div className={cn("flex min-w-0 flex-col gap-1", mine ? "items-end" : "items-start")}>
          {message.deleted ? (
            <p className="rounded-2xl border border-dashed border-border px-3.5 py-2 text-[0.8438rem] italic text-muted-foreground">
              {t("messages.deleted")}
            </p>
          ) : (
            <>
              {message.image ? (
                <a href={message.image.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element -- authorised, re-encoded image */}
                  <img src={message.image.url} alt={t("messages.photo")} loading="lazy" className="max-h-72 max-w-full object-cover" />
                </a>
              ) : null}
              {message.replyTo ? (
                <button
                  type="button"
                  onClick={() => message.replyTo && onJumpTo(message.replyTo.id)}
                  className={cn(
                    "max-w-full rounded-xl border-l-2 border-primary/60 bg-surface-muted/70 px-2.5 py-1.5 text-left text-[0.7812rem]",
                    mine ? "self-end" : "self-start",
                  )}
                >
                  <span className="block font-semibold">{message.replyTo.senderName}</span>
                  <span className="line-clamp-2 text-muted-foreground">
                    {message.replyTo.deleted ? t("messages.deleted") : message.replyTo.preview || (message.replyTo.hasImage ? `📷 ${t("messages.photo")}` : "")}
                  </span>
                </button>
              ) : null}
              {sharedPostId(message.content) ? <PostLinkPreview postId={sharedPostId(message.content) as string} /> : null}
              {message.content ? (
                <p
                  title={fmt.dateTime(message.createdAt)}
                  className={cn(
                    "whitespace-pre-line break-words rounded-2xl px-3.5 py-2 text-[0.9062rem] leading-snug [overflow-wrap:anywhere]",
                    mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-surface-muted text-foreground",
                  )}
                >
                  {message.content}
                </p>
              ) : null}
            </>
          )}
        </div>

        {canReact ? (
          <Popover open={picker} onOpenChange={setPicker}>
            <PopoverTrigger
              aria-label={t("messages.react")}
              className="grid size-7 shrink-0 place-items-center self-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-surface-muted focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-60"
            >
              <SmilePlus className="size-4" />
            </PopoverTrigger>
            <PopoverContent side="top" align={mine ? "end" : "start"} className="flex w-auto gap-0.5 rounded-full p-1">
              {REACTION_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-label={t(REACTION_LABEL[type])}
                  aria-pressed={mineReaction === type}
                  onClick={() => void react(mineReaction === type ? null : type)}
                  className={cn("grid size-9 place-items-center rounded-full text-[1.25rem] transition-transform hover:scale-125", mineReaction === type && "bg-primary/15")}
                >
                  {REACTION_EMOJI[type]}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        ) : null}

        {!message.pending && !message.failed ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t("common.more")}
              className="grid size-7 shrink-0 place-items-center self-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-surface-muted focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align={mine ? "end" : "start"}>
              {!message.deleted ? (
                <DropdownMenuItem onSelect={onReply}>
                  <CornerUpLeft />
                  {t("messages.reply")}
                </DropdownMenuItem>
              ) : null}
              {!message.deleted && message.content ? (
                <DropdownMenuItem onSelect={onCopy}>
                  <Copy />
                  {t("messages.copy")}
                </DropdownMenuItem>
              ) : null}
              {editable ? (
                <DropdownMenuItem onSelect={onEdit}>
                  <Pencil />
                  {t("messages.edit")}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onDeleteForMe}>
                <Trash2 />
                {t("messages.delete_me")}
              </DropdownMenuItem>
              {mine && !message.deleted ? (
                <DropdownMenuItem variant="destructive" onSelect={onDeleteForEveryone}>
                  <Undo2 />
                  {t("messages.delete_all")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {message.reactions.length > 0 && !message.deleted ? (
        <div className={cn("-mt-1 flex flex-wrap gap-1", mine ? "mr-2" : "ml-12")} aria-label={t("messages.reactions_label")}>
          {message.reactions.map((entry) => (
            <button
              key={entry.type}
              type="button"
              onClick={() => setReactorsOpen(true)}
              title={t(REACTION_LABEL[entry.type])}
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full border bg-card px-1.5 py-0.5 text-[0.75rem] shadow-sm hover:bg-surface-muted",
                entry.userIds.includes(viewerId) ? "border-primary/60" : "border-border",
              )}
            >
              <span aria-hidden>{REACTION_EMOJI[entry.type]}</span>
              {entry.userIds.length > 1 ? <span className="tabular-nums text-muted-foreground">{entry.userIds.length}</span> : null}
            </button>
          ))}
          <ReactorsDialog open={reactorsOpen} onOpenChange={setReactorsOpen} load={loadReactors} />
        </div>
      ) : null}

      <div className={cn("mt-0.5 flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground", mine ? "mr-1" : "ml-11")}>
        {message.failed ? (
          <button type="button" onClick={onDiscard} className="inline-flex items-center gap-1 text-error hover:underline">
            <AlertCircle className="size-3" />
            {message.failed === "timeout" || message.failed === "error" ? t("errors.network") : message.failed}
          </button>
        ) : null}
        {message.editedAt && !message.deleted ? <span>{t("messages.edited")}</span> : null}
        {status && readers.length === 0 ? <span aria-live="polite">{status}</span> : null}
        {readers.length > 0 ? (
          <span className="flex -space-x-1" aria-label={t("messages.seen_by", { names: readers.map((reader) => reader.name).join(", ") })} title={t("messages.seen_by", { names: readers.map((reader) => reader.name).join(", ") })}>
            {readers.slice(0, 5).map((reader) => (
              <UserAvatar key={reader.userId} userId={reader.userId} name={reader.name} image={reader.image} size="2xs" className="ring-2 ring-card" />
            ))}
          </span>
        ) : null}
      </div>
    </div>
  );
}
