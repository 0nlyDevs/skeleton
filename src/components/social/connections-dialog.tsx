"use client";

import { Loader2, UserRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { UserAvatar } from "@/components/shell/user-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Link from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, toQueryString } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import type { ConnectionDto } from "@/modules/follows/follows.dto";

import { FollowButton } from "./follow-button";
import { RelationBadge } from "./relation-badge";

type Kind = "followers" | "following";

/** Followers / followings of a profile, with follow buttons and "Amis" badges. */
export function ConnectionsDialog({
  username,
  open,
  onOpenChange,
  initialKind,
  signedIn,
}: {
  readonly username: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly initialKind: Kind;
  readonly signedIn: boolean;
}) {
  const t = useTranslation();
  const [kind, setKind] = useState<Kind>(initialKind);
  const [items, setItems] = useState<ConnectionDto[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setKind(initialKind);
  }, [open, initialKind]);

  const load = useCallback(
    async (next: string | null) => {
      const response = await apiFetch<{ data: ConnectionDto[]; nextCursor: string | null }>(
        `/api/profiles/${encodeURIComponent(username)}/connections${toQueryString({ kind, cursor: next ?? undefined, limit: 20 })}`,
      );
      return response;
    },
    [kind, username],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setItems(null);
    setError(null);
    load(null)
      .then((response) => {
        if (cancelled) return;
        setItems(response.data);
        setCursor(response.nextCursor);
      })
      .catch((caught: unknown) => !cancelled && setError(describeApiError(caught, t)));
    return () => {
      cancelled = true;
    };
  }, [open, load, t]);

  const more = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await load(cursor);
      setItems((current) => [...(current ?? []), ...response.data]);
      setCursor(response.nextCursor);
    } catch (caught) {
      setError(describeApiError(caught, t));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="px-5 pb-2 pt-5">
          <DialogTitle>@{username}</DialogTitle>
          <DialogDescription className="sr-only">{t(kind === "followers" ? "profile.public.followers" : "profile.public.following")}</DialogDescription>
        </DialogHeader>
        <div role="tablist" className="flex border-b border-border/60 px-3">
          {(["followers", "following"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={kind === value}
              onClick={() => setKind(value)}
              className={cn(
                "flex-1 border-b-2 px-3 py-2.5 text-[14px] font-semibold",
                kind === value ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t(value === "followers" ? "profile.public.followers" : "profile.public.following")}
            </button>
          ))}
        </div>
        <div className="max-h-[60dvh] overflow-y-auto px-2 py-2">
          {error ? (
            <p className="px-3 py-6 text-center text-[13px] text-error">{error}</p>
          ) : items === null ? (
            <div className="flex flex-col gap-2 p-2">
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="flex flex-col items-center gap-2 px-3 py-8 text-center text-[13px] text-muted-foreground">
              <UserRound className="size-6" aria-hidden />
              {t(kind === "followers" ? "connections.no_followers" : "connections.no_following")}
            </p>
          ) : (
            <ul className="flex flex-col">
              {items.map((person) => (
                <li key={person.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-muted">
                  <Link href={`/profile/${encodeURIComponent(person.username)}`} onClick={() => onOpenChange(false)} className="flex min-w-0 flex-1 items-center gap-3">
                    <UserAvatar userId={person.id} name={person.name} image={person.image} size="sm" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[14px] font-medium">{person.name}</span>
                        <RelationBadge isFriend={person.isFriend} followsYou={person.followsYou} />
                      </span>
                      <span className="block truncate text-[12px] text-muted-foreground">@{person.username}</span>
                    </span>
                  </Link>
                  {signedIn && !person.isSelf ? <FollowButton userId={person.id} initialFollowing={person.isFollowing} compact /> : null}
                </li>
              ))}
            </ul>
          )}
          {cursor ? (
            <Button variant="ghost" className="mt-1 w-full" onClick={() => void more()} disabled={loadingMore}>
              {loadingMore ? <Loader2 className="animate-spin" /> : null}
              {t("connections.more")}
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
