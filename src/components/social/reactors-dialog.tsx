"use client";

import Link from "@/components/ui/link";
import { useEffect, useMemo, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { UserAvatar } from "@/components/shell/user-avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { describeApiError } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";

export interface Reactor {
  readonly emoji: string;
  readonly user: { readonly id: string; readonly name: string; readonly username: string | null; readonly image: string | null };
}

/**
 * "Who reacted": tabs per emoji (with counts) and the people behind them.
 * Shared by posts and chat messages; the caller decides how to load the list,
 * and the server decides who may see it.
 */
export function ReactorsDialog({
  open,
  onOpenChange,
  load,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly load: () => Promise<Reactor[]>;
}) {
  const t = useTranslation();
  const [reactors, setReactors] = useState<Reactor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<string>("all");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setReactors(null);
    setError(null);
    setTab("all");
    load()
      .then((list) => !cancelled && setReactors(list))
      .catch((caught: unknown) => !cancelled && setError(describeApiError(caught, t)));
    return () => {
      cancelled = true;
    };
  }, [open, load, t]);

  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const reactor of reactors ?? []) counts.set(reactor.emoji, (counts.get(reactor.emoji) ?? 0) + 1);
    return [...counts].sort((left, right) => right[1] - left[1]);
  }, [reactors]);
  const shown = (reactors ?? []).filter((reactor) => tab === "all" || reactor.emoji === tab);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-3 p-0">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle>{t("reactors.title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("reactors.title")}</DialogDescription>
        </DialogHeader>
        {groups.length > 0 ? (
          <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-border/60 px-4">
            {[["all", reactors?.length ?? 0] as const, ...groups].map(([key, count]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cn(
                  "flex shrink-0 items-center gap-1 border-b-2 px-2.5 py-2 text-[13.5px] font-semibold",
                  tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {key === "all" ? t("reactors.all") : <span aria-hidden>{key}</span>}
                <span className="tabular-nums">{count}</span>
              </button>
            ))}
          </div>
        ) : null}
        <div className="max-h-[60dvh] overflow-y-auto px-3 pb-4">
          {error ? (
            <p className="px-2 py-6 text-center text-[13px] text-error">{error}</p>
          ) : reactors === null ? (
            <div className="flex flex-col gap-2 p-2">
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-10 rounded-xl" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <p className="px-2 py-6 text-center text-[13px] text-muted-foreground">{t("reactors.empty")}</p>
          ) : (
            <ul className="flex flex-col">
              {shown.map((reactor) => (
                <li key={`${reactor.user.id}:${reactor.emoji}`}>
                  <Link
                    href={reactor.user.username ? `/profile/${encodeURIComponent(reactor.user.username)}` : "#"}
                    className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-muted"
                  >
                    <span className="relative">
                      <UserAvatar userId={reactor.user.id} name={reactor.user.name} image={reactor.user.image} size="sm" />
                      <span aria-hidden className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full bg-card text-[12px] ring-2 ring-card">
                        {reactor.emoji}
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-medium">{reactor.user.name}</span>
                      {reactor.user.username ? <span className="block truncate text-[12px] text-muted-foreground">@{reactor.user.username}</span> : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
