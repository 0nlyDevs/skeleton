"use client";

import { Check, Loader2, Repeat2, Search, Send, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { UserAvatar } from "@/components/shell/user-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import type { RoomDto } from "@/modules/messages/messages.dto";
import type { FeedItemDto, RepostedPostDto } from "@/modules/posts/posts.dto";

import { AudiencePicker, type Audience } from "./audience";
import { MentionInput } from "./mention-input";
import { RepostEmbed } from "./repost-embed";

/** Repost to one's own feed, with an optional caption. */
export async function sharePost(originalId: string, body = "", audience: Audience = "PUBLIC"): Promise<FeedItemDto> {
  const response = await apiFetch<{ data: FeedItemDto }>("/api/posts", {
    method: "POST",
    body: { repostOfId: originalId, body, published: true, audience },
  });
  return response.data;
}

interface Target {
  readonly key: string;
  readonly label: string;
  readonly image: string | null;
  readonly userId: string | null;
  readonly roomId: string | null;
  readonly group: boolean;
}

/**
 * The one Share button: repost (caption optional, audience of your choice), or
 * send the post to people and group chats as a message.
 */
export function ShareDialog({
  original,
  postId,
  open,
  onOpenChange,
  onShared,
}: {
  /** `null` when the post cannot be reposted (not public): sending still works. */
  readonly original: RepostedPostDto | null;
  readonly postId: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onShared?: (post: FeedItemDto) => void;
}) {
  const t = useTranslation();
  const [tab, setTab] = useState<"repost" | "send">(original ? "repost" : "send");
  const [caption, setCaption] = useState("");
  const [audience, setAudience] = useState<Audience>("PUBLIC");
  const [busy, setBusy] = useState(false);
  const [rooms, setRooms] = useState<Target[] | null>(null);
  const [people, setPeople] = useState<Target[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ReadonlyMap<string, Target>>(new Map());

  useEffect(() => {
    if (!open) return;
    setTab(original ? "repost" : "send");
    setSelected(new Map());
    setCaption("");
  }, [open, original]);

  useEffect(() => {
    if (!open || tab !== "send" || rooms !== null) return;
    void apiFetch<{ data: RoomDto[] }>("/api/messages/rooms")
      .then((response) =>
        setRooms(
          response.data
            .filter((room) => room.type === "DIRECT" || room.type === "GROUP")
            .map((room) => ({
              key: `room:${room.id}`,
              label: room.targetUser?.name ?? room.name,
              image: room.targetUser?.image ?? null,
              userId: room.targetUser?.id ?? null,
              roomId: room.id,
              group: room.type === "GROUP",
            })),
        ),
      )
      .catch(() => setRooms([]));
  }, [open, tab, rooms]);

  useEffect(() => {
    const term = query.trim();
    if (tab !== "send" || term.length < 2) {
      setPeople([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void apiFetch<{ data: { id: string; name: string; image: string | null }[] }>(`/api/users/search?q=${encodeURIComponent(term)}&limit=8`, { signal: controller.signal })
        .then((response) =>
          setPeople(response.data.map((person) => ({ key: `user:${person.id}`, label: person.name, image: person.image, userId: person.id, roomId: null, group: false }))),
        )
        .catch(() => undefined);
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, tab]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const fromRooms = (rooms ?? []).filter((room) => !term || room.label.toLowerCase().includes(term));
    const known = new Set(fromRooms.map((room) => room.userId).filter(Boolean));
    return [...fromRooms, ...people.filter((person) => !known.has(person.userId))];
  }, [rooms, people, query]);

  const toggle = (target: Target) =>
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(target.key)) next.delete(target.key);
      else if (next.size < 20) next.set(target.key, target);
      return next;
    });

  const repost = async () => {
    if (!original) return;
    setBusy(true);
    try {
      const post = await sharePost(original.id, caption.trim(), audience);
      toast.success(t("share.done"));
      onShared?.(post);
      onOpenChange(false);
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (selected.size === 0) {
      toast(t("share.pick_someone"));
      return;
    }
    setBusy(true);
    const link = `${window.location.origin}/feed/${encodeURIComponent(postId)}`;
    const content = caption.trim() ? `${caption.trim()}\n${link}` : link;
    let sent = 0;
    for (const target of selected.values()) {
      try {
        let roomId = target.roomId;
        if (!roomId && target.userId) {
          const room = await apiFetch<{ data: { id: string } }>("/api/messages/rooms", { method: "POST", body: { type: "DIRECT", targetUserId: target.userId } });
          roomId = room.data.id;
        }
        if (!roomId) continue;
        await apiFetch("/api/messages", { method: "POST", body: { roomId, content } });
        sent += 1;
      } catch (error) {
        toast.error(`${target.label} : ${describeApiError(error, t)}`);
      }
    }
    setBusy(false);
    if (sent > 0) void apiFetch(`/api/posts/${encodeURIComponent(postId)}/shares`, { method: "POST" }).catch(() => undefined);
    if (sent > 0) {
      toast.success(t("share.sent", { count: sent }));
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("share.title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("share.title")}</DialogDescription>
        </DialogHeader>
        <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl bg-surface-muted p-1">
          {(["repost", "send"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              disabled={value === "repost" && !original}
              onClick={() => setTab(value)}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[0.8125rem] font-semibold disabled:opacity-40",
                tab === value ? "bg-card shadow-sm" : "text-muted-foreground",
              )}
            >
              {value === "repost" ? <Repeat2 className="size-4" /> : <Send className="size-4" />}
              {t(value === "repost" ? "share.tab_repost" : "share.tab_send")}
            </button>
          ))}
        </div>
        {!original && tab === "send" ? <p className="text-[0.7812rem] text-muted-foreground">{t("share.not_repostable")}</p> : null}

        <div className="rounded-2xl bg-surface-muted focus-within:ring-2 focus-within:ring-ring/25">
          <MentionInput
            value={caption}
            onChange={setCaption}
            placeholder={tab === "repost" ? t("share.caption_placeholder") : t("share.message_placeholder")}
            minRows={2}
            maxRows={6}
            maxLength={tab === "repost" ? 20_000 : 1_500}
          />
        </div>

        {tab === "repost" && original ? (
          <>
            <div className="flex items-center justify-between">
              <AudiencePicker value={audience} onChange={setAudience} />
              <span className="text-[0.75rem] text-muted-foreground">{t("share.caption_optional")}</span>
            </div>
            <div className="max-h-[35dvh] overflow-y-auto">
              <RepostEmbed original={original} />
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("share.search_people")} className="pl-9" />
            </label>
            <ul className="max-h-[35dvh] overflow-y-auto">
              {rooms === null ? (
                <li className="flex justify-center py-6">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </li>
              ) : visible.length === 0 ? (
                <li className="py-6 text-center text-[0.8125rem] text-muted-foreground">{t("share.nobody")}</li>
              ) : (
                visible.map((target) => {
                  const on = selected.has(target.key);
                  return (
                    <li key={target.key}>
                      <button
                        type="button"
                        onClick={() => toggle(target)}
                        aria-pressed={on}
                        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-muted"
                      >
                        {target.group ? (
                          <span className="grid size-9 place-items-center rounded-full bg-primary/12 text-primary">
                            <UsersRound className="size-4" />
                          </span>
                        ) : (
                          <UserAvatar userId={target.userId ?? undefined} name={target.label} image={target.image} size="sm" />
                        )}
                        <span className="min-w-0 flex-1 truncate text-[0.875rem] font-medium">{target.label}</span>
                        <span className={cn("grid size-5 place-items-center rounded-full border", on ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                          {on ? <Check className="size-3" /> : null}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          {tab === "repost" ? (
            <Button onClick={() => void repost()} disabled={busy || !original}>
              {busy ? <Loader2 className="animate-spin" /> : <Repeat2 />}
              {t("share.repost")}
            </Button>
          ) : (
            <Button onClick={() => void send()} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Send />}
              {selected.size > 0 ? t("share.send_count", { count: selected.size }) : t("share.send")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
