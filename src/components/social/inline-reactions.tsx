"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import { REACTION_TYPES, type ReactionType } from "@/types";

import { ReactionIcon, REACTION_LABEL } from "./reactions";
import { ReactorsDialog } from "./reactors-dialog";

export interface InlineReaction {
  readonly type: ReactionType;
  readonly userIds: readonly string[];
}

/**
 * "J'aime" + emoji picker and the reaction chips under a comment. `endpoint`
 * answers PUT {type} / DELETE with the updated item and GET with the reactors.
 */
export function InlineReactions<T extends { reactions: readonly InlineReaction[] }>({
  reactions,
  viewerId,
  endpoint,
  onUpdated,
}: {
  readonly reactions: readonly InlineReaction[];
  readonly viewerId: string | null;
  readonly endpoint: string;
  readonly onUpdated: (item: T) => void;
}) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const mine = viewerId ? (reactions.find((entry) => entry.userIds.includes(viewerId))?.type ?? null) : null;
  const total = reactions.reduce((sum, entry) => sum + entry.userIds.length, 0);

  const react = async (type: ReactionType | null) => {
    setOpen(false);
    try {
      const response = await apiFetch<{ data: T }>(endpoint, type ? { method: "PUT", body: { type } } : { method: "DELETE" });
      onUpdated(response.data);
    } catch (error) {
      toast.error(describeApiError(error, t));
    }
  };

  const load = useCallback(async () => {
    const response = await apiFetch<{ data: { type: ReactionType; user: { id: string; name: string; username: string | null; image: string | null } }[] }>(endpoint);
    return response.data.map((row) => ({ type: row.type, user: row.user }));
  }, [endpoint]);

  return (
    <>
      {viewerId ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn("font-semibold hover:underline", mine && "text-primary")}
              onClick={(event) => {
                // A plain click toggles "J'aime"; the picker opens on long press / hover.
                if (event.detail > 0 && !open) {
                  event.preventDefault();
                  void react(mine ? null : "LIKE");
                }
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                setOpen(true);
              }}
              onPointerEnter={(event) => event.pointerType === "mouse" && setOpen(true)}
            >
              {mine ? <span className="inline-flex items-center gap-1.5"><ReactionIcon type={mine} className="size-4" />{t(REACTION_LABEL[mine])}</span> : t("reactions.LIKE")}
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="flex w-auto gap-0.5 rounded-full p-1" onPointerLeave={() => setOpen(false)}>
            {REACTION_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                aria-label={t(REACTION_LABEL[type])}
                aria-pressed={mine === type}
                onClick={() => void react(mine === type ? null : type)}
                className={cn("grid size-8 place-items-center rounded-full text-[1.125rem] transition-transform hover:scale-125", mine === type && "bg-primary/15")}
              >
                <ReactionIcon type={type} className="size-[1.125rem]" />
              </button>
            ))}
          </PopoverContent>
        </Popover>
      ) : null}
      {total > 0 ? (
        <button type="button" onClick={() => setListOpen(true)} className="inline-flex items-center gap-0.5 rounded-full bg-card px-1.5 py-0.5 shadow-sm hover:bg-surface-muted" aria-label={t("reactors.open", { count: total })}>
          <span aria-hidden className="flex -space-x-1">{reactions.slice(0, 3).map((entry) => <ReactionIcon key={entry.type} type={entry.type} className="size-3.5" />)}</span>
          <span className="tabular-nums">{total}</span>
        </button>
      ) : null}
      <ReactorsDialog open={listOpen} onOpenChange={setListOpen} load={load} />
    </>
  );
}
