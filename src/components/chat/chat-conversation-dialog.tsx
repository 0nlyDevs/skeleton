"use client";

import { Check, Loader2, MessageSquarePlus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiFetch, toQueryString } from "@/lib/api/client";
import { initials } from "@/lib/utils";

export interface ChatRoom {
  readonly id: string;
  readonly name: string;
  readonly type: "GLOBAL" | "POST" | "DIRECT" | "GROUP";
  readonly unreadCount: number;
  readonly members?: readonly ChatMember[];
  readonly targetUser?: { readonly id: string; readonly name: string; readonly username: string | null; readonly image: string | null } | null;
}

export interface ChatMember {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly username: string | null;
  readonly image: string | null;
  readonly role: string;
}

interface SearchUser {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly image: string | null;
}

export function ChatConversationDialog({
  open,
  onOpenChange,
  onCreated,
  currentRoom,
  onMemberAdded,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onCreated: (room: ChatRoom) => void;
  readonly currentRoom?: ChatRoom;
  readonly onMemberAdded?: () => void;
}) {
  const t = useTranslation();
  const addMode = Boolean(currentRoom);
  const [group, setGroup] = useState(false);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || query.trim().length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void apiFetch<{ data: SearchUser[] }>(`/api/users/search${toQueryString({ q: query.trim(), limit: 12 })}`)
        .then((response) => {
          if (!cancelled) setResults(response.data);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query]);

  const currentMemberIds = useMemo(
    () => new Set(currentRoom?.members?.map((member) => member.userId) ?? []),
    [currentRoom],
  );
  const available = results.filter((result) => !currentMemberIds.has(result.id));

  const reset = () => {
    setGroup(false);
    setName("");
    setQuery("");
    setResults([]);
    setSelected([]);
  };

  const changeQuery = (value: string) => {
    setQuery(value);
    setResults([]);
    setLoading(value.trim().length >= 2);
  };

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  const chooseUser = async (user: SearchUser) => {
    if (addMode) {
      setBusy(true);
      try {
        await apiFetch(`/api/messages/rooms/${encodeURIComponent(currentRoom?.id ?? "")}/members`, {
          method: "POST",
          body: { userId: user.id },
        });
        toast.success(t("chat.member_added"));
        close(false);
        onMemberAdded?.();
      } catch {
        toast.error(t("feedback.error.body"));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!group) {
      setBusy(true);
      try {
        const response = await apiFetch<{ data: ChatRoom }>("/api/messages/rooms", {
          method: "POST",
          body: { type: "DIRECT", targetUserId: user.id },
        });
        onCreated(response.data);
        close(false);
      } catch {
        toast.error(t("feedback.error.body"));
      } finally {
        setBusy(false);
      }
      return;
    }

    setSelected((current) => current.includes(user.id)
      ? current.filter((id) => id !== user.id)
      : [...current, user.id]);
  };

  const createGroup = async () => {
    if (!name.trim() || selected.length === 0 || busy) return;
    setBusy(true);
    try {
      const response = await apiFetch<{ data: ChatRoom }>("/api/messages/rooms", {
        method: "POST",
        body: { type: "GROUP", name: name.trim(), memberIds: selected },
      });
      onCreated(response.data);
      close(false);
    } catch {
      toast.error(t("feedback.error.body"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {addMode ? t("chat.add_member") : group ? t("chat.new_group") : t("chat.new_direct")}
          </DialogTitle>
          <DialogDescription>{t("chat.select_members")}</DialogDescription>
        </DialogHeader>

        {!addMode ? (
          <div className="flex gap-2">
            <Button variant={!group ? "secondary" : "outline"} onClick={() => setGroup(false)}>
              <MessageSquarePlus />{t("chat.direct")}
            </Button>
            <Button variant={group ? "secondary" : "outline"} onClick={() => setGroup(true)}>
              <Users />{t("chat.groups")}
            </Button>
          </div>
        ) : null}

        {!addMode && group ? (
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("chat.group_name")} maxLength={100} />
        ) : null}

        <Input
          value={query}
          onChange={(event) => changeQuery(event.target.value)}
          placeholder={t("chat.search_users")}
          aria-label={t("chat.search_users")}
          autoFocus
        />
        {selected.length > 0 ? (
          <p className="text-[12px] text-muted-foreground">{t("chat.selected_count", { count: selected.length })}</p>
        ) : null}
        <div className="max-h-64 overflow-y-auto rounded-lg border border-border/70">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-5 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />{t("search.loading")}</div>
          ) : available.map((user) => {
            const isSelected = selected.includes(user.id);
            return (
              <button
                key={user.id}
                type="button"
                onClick={() => void chooseUser(user)}
                disabled={busy}
                className="flex w-full items-center gap-3 border-b border-border/50 px-3 py-2.5 text-left last:border-0 hover:bg-surface-muted disabled:opacity-60"
              >
                <Avatar className="size-8"><AvatarImage src={user.image ?? undefined} alt="" /><AvatarFallback>{initials(user.name)}</AvatarFallback></Avatar>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{user.name}</span><span className="block truncate text-xs text-muted-foreground">@{user.username}</span></span>
                {isSelected ? <Check className="size-4 text-primary" /> : null}
              </button>
            );
          })}
          {!loading && available.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">{query.trim().length < 2 ? t("search.min_chars") : t("search.empty.title")}</p>
          ) : null}
        </div>
        {!addMode && group ? (
          <DialogFooter>
            <Button onClick={() => void createGroup()} disabled={busy || !name.trim() || selected.length === 0}>
              {busy ? <Loader2 className="animate-spin" /> : null}{t("chat.create_group")}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
