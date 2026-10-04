"use client";

import { Loader2, MessageCircle, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { UserAvatar } from "@/components/shell/user-avatar";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";

/**
 * A name or an avatar in a conversation, as a way to the person: their
 * profile, and "continue in private" to take the discussion to a one-to-one
 * chat. Nothing for your own messages.
 */
export function SenderMenu({
  person,
  mine,
  children,
  className,
}: {
  readonly person: { readonly id: string; readonly name: string; readonly username: string | null; readonly image: string | null };
  readonly mine: boolean;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  const t = useTranslation();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  if (mine) return <>{children}</>;

  const privateChat = async () => {
    setBusy(true);
    try {
      const { data } = await apiFetch<{ data: { id: string } }>("/api/messages/rooms", { method: "POST", body: { type: "DIRECT", targetUserId: person.id } });
      setOpen(false);
      router.push(`/messages?room=${encodeURIComponent(data.id)}`);
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={className ?? "rounded-md hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"} aria-label={t("tn.sender.open", { name: person.name })}>
        {children}
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-64 flex-col gap-3 rounded-2xl p-3">
        <div className="flex items-center gap-3">
          <UserAvatar userId={person.id} name={person.name} image={person.image} size="md" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{person.name}</p>
            {person.username ? <p className="truncate text-[0.8125rem] text-muted-foreground">@{person.username}</p> : null}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          {person.username ? (
            <Button asChild variant="secondary" size="sm" className="justify-start">
              <Link href={`/profile/${encodeURIComponent(person.username)}`}>
                <UserRound aria-hidden />
                {t("tn.sender.profile")}
              </Link>
            </Button>
          ) : null}
          <Button type="button" size="sm" className="justify-start" disabled={busy} onClick={() => void privateChat()}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <MessageCircle aria-hidden />}
            {t("tn.sender.private")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
