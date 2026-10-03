"use client";

import { MessageCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import type { RoomDto } from "@/modules/messages/messages.dto";

import { ConversationList } from "./conversation-list";
import { ConversationThread } from "./conversation-thread";
import { NewConversationDialog } from "./new-conversation-dialog";
import { useConversations } from "./use-conversations";

/** Inbox + conversation, side by side on desktop, one at a time on phones. */
export function MessagesView({ viewer }: { readonly viewer: { id: string; name: string; image: string | null } }) {
  const t = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const { rooms, upsert, refresh, typingRooms } = useConversations();
  const [activeId, setActiveId] = useState<string | null>(params.get("room"));
  const [dialog, setDialog] = useState<"direct" | "group" | null>(null);
  const openedTarget = useRef<string | null>(null);

  const select = useCallback(
    (roomId: string | null) => {
      setActiveId(roomId);
      router.replace(roomId ? `/messages?room=${encodeURIComponent(roomId)}` : "/messages", { scroll: false });
    },
    [router],
  );

  // `/messages?to=<userId>` (from a profile or a contact) opens — or creates —
  // the direct conversation with that person.
  useEffect(() => {
    const target = params.get("to");
    if (!target || openedTarget.current === target) return;
    openedTarget.current = target;
    void apiFetch<{ data: RoomDto }>("/api/messages/rooms", { method: "POST", body: { type: "DIRECT", targetUserId: target } })
      .then((response) => {
        upsert(response.data);
        select(response.data.id);
      })
      .catch((error: unknown) => toast.error(describeApiError(error, t)));
  }, [params, upsert, select, t]);

  const active = rooms?.find((room) => room.id === activeId) ?? null;

  return (
    <Card className="grid h-[calc(100dvh-8.5rem)] min-h-[480px] overflow-hidden md:grid-cols-[340px_minmax(0,1fr)] lg:h-[calc(100dvh-7rem)]">
      <aside className={cn("min-h-0 border-r border-border/60", active ? "hidden md:block" : "block")}>
        <ConversationList
          rooms={rooms}
          activeId={activeId}
          viewerId={viewer.id}
          onSelect={select}
          onNew={() => setDialog("direct")}
          onNewGroup={() => setDialog("group")}
          typingRooms={typingRooms}
        />
      </aside>
      <section className={cn("min-h-0", active ? "block" : "hidden md:block")}>
        {active ? (
          <ConversationThread
            key={active.id}
            room={active}
            viewer={viewer}
            onBack={() => select(null)}
            onLeft={() => {
              select(null);
              void refresh();
            }}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <span className="grid size-16 place-items-center rounded-full bg-accent text-accent-foreground">
              <MessageCircle className="size-8" />
            </span>
            <p className="text-[0.9375rem] font-semibold">{t("messages.select")}</p>
            <p className="max-w-xs text-[0.8125rem] text-muted-foreground">{t("messages.empty_body")}</p>
          </div>
        )}
      </section>
      <NewConversationDialog
        mode={dialog}
        onOpenChange={(open) => !open && setDialog(null)}
        onCreated={(room) => {
          upsert(room);
          select(room.id);
        }}
      />
    </Card>
  );
}
