"use client";

import { AlertCircle, Copy, Loader2, MoreHorizontal, Pencil, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { UserAvatar } from "@/components/shell/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RoomMemberDto } from "@/modules/messages/messages.dto";

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
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
  onCopy,
  onDiscard,
}: {
  readonly message: ThreadMessage;
  readonly mine: boolean;
  readonly showAuthor: boolean;
  readonly showAvatar: boolean;
  readonly readers: readonly RoomMemberDto[];
  readonly onEdit: () => void;
  readonly onDeleteForMe: () => void;
  readonly onDeleteForEveryone: () => void;
  readonly onCopy: () => void;
  readonly onDiscard: () => void;
}) {
  const t = useTranslation();
  // Captured once per mount: the 24-hour window is a hint, the server enforces it.
  const [mountedAt] = useState(() => Date.now());
  const editable = mine && !message.deleted && !message.pending && !message.failed && mountedAt - Date.parse(message.createdAt) < EDIT_WINDOW_MS;

  return (
    <div className={cn("group flex flex-col", mine ? "items-end" : "items-start")}>
      {showAuthor && !mine ? <span className="mb-0.5 ml-11 text-[11.5px] font-medium text-muted-foreground">{message.sender.name}</span> : null}
      <div className={cn("flex max-w-[85%] items-end gap-2 sm:max-w-[70%]", mine && "flex-row-reverse")}>
        {!mine ? (
          <span className="w-9 shrink-0">{showAvatar ? <UserAvatar name={message.sender.name} image={message.sender.image} size="sm" /> : null}</span>
        ) : null}

        <div className={cn("flex min-w-0 flex-col gap-1", mine ? "items-end" : "items-start")}>
          {message.deleted ? (
            <p className="rounded-2xl border border-dashed border-border px-3.5 py-2 text-[13.5px] italic text-muted-foreground">
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
              {message.content ? (
                <p
                  title={formatDateTime(message.createdAt)}
                  className={cn(
                    "whitespace-pre-line break-words rounded-2xl px-3.5 py-2 text-[14.5px] leading-snug [overflow-wrap:anywhere]",
                    mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-surface-muted text-foreground",
                    message.pending && "opacity-70",
                  )}
                >
                  {message.content}
                </p>
              ) : null}
            </>
          )}
        </div>

        {!message.pending && !message.failed ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t("common.more")}
              className="grid size-7 shrink-0 place-items-center self-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-surface-muted focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align={mine ? "end" : "start"}>
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

      <div className={cn("mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground", mine ? "mr-1" : "ml-11")}>
        {message.pending ? <Loader2 className="size-3 animate-spin" aria-label="sending" /> : null}
        {message.failed ? (
          <button type="button" onClick={onDiscard} className="inline-flex items-center gap-1 text-error hover:underline">
            <AlertCircle className="size-3" />
            {message.failed === "timeout" || message.failed === "error" ? t("errors.network") : message.failed}
          </button>
        ) : null}
        {message.editedAt && !message.deleted ? <span>{t("messages.edited")}</span> : null}
        {readers.length > 0 ? (
          <span className="flex -space-x-1" aria-label={t("messages.seen_by", { names: readers.map((reader) => reader.name).join(", ") })} title={t("messages.seen_by", { names: readers.map((reader) => reader.name).join(", ") })}>
            {readers.slice(0, 5).map((reader) => (
              <UserAvatar key={reader.userId} name={reader.name} image={reader.image} size="2xs" className="ring-2 ring-card" />
            ))}
          </span>
        ) : null}
      </div>
    </div>
  );
}
