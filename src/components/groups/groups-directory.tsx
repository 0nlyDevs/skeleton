"use client";

import { Lock, Plus, Search, UsersRound } from "lucide-react";
import Link from "@/components/ui/link";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/feedback/empty-state";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch, toQueryString } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { GroupSummaryDto } from "@/modules/groups/groups.dto";

import { CreateGroupDialog } from "./create-group-dialog";
import { GroupAvatar } from "./group-avatar";

export function GroupsDirectory({ signedIn, initialMine }: { readonly signedIn: boolean; readonly initialMine: readonly GroupSummaryDto[] }) {
  const t = useTranslation();
  const [tab, setTab] = useState<"discover" | "mine">(signedIn && initialMine.length > 0 ? "mine" : "discover");
  const [q, setQ] = useState("");
  const term = useDebouncedValue(q.trim(), 250);
  const [groups, setGroups] = useState<GroupSummaryDto[] | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setGroups(null);
    void apiFetch<{ data: GroupSummaryDto[] }>(`/api/groups${toQueryString({ scope: tab, q: tab === "discover" ? term : undefined, limit: 40 })}`)
      .then((response) => !cancelled && setGroups(response.data))
      .catch(() => !cancelled && setGroups([]));
    return () => {
      cancelled = true;
    };
  }, [tab, term]);

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">{t("groups.title")}</h1>
          <p className="text-[13.5px] text-muted-foreground">{t("groups.subtitle")}</p>
        </div>
        {signedIn ? (
          <Button onClick={() => setCreating(true)}>
            <Plus />
            {t("groups.create")}
          </Button>
        ) : null}
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        {signedIn ? (
          <div role="tablist" className="flex gap-1 rounded-2xl bg-card p-1 shadow-panel">
            {(["mine", "discover"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={cn(
                  "rounded-xl px-4 py-2 text-[13.5px] font-semibold",
                  tab === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-muted",
                )}
              >
                {value === "mine" ? t("groups.mine") : t("groups.discover")}
              </button>
            ))}
          </div>
        ) : null}
        {tab === "discover" ? (
          <label className="relative ml-auto w-full sm:w-72">
            <span className="sr-only">{t("search.groups")}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder={t("search.groups")}
              className="h-10 w-full rounded-full border border-border bg-card pl-9 pr-3 text-[13.5px] outline-none focus:ring-2 focus:ring-ring/25"
            />
          </label>
        ) : null}
      </div>

      {groups === null ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-28 rounded-2xl" />)}
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={UsersRound}
            title={tab === "mine" ? t("groups.mine") : t("groups.discover")}
            description={tab === "mine" ? t("groups.empty_mine") : t("groups.empty_discover")}
            className="border-0 bg-transparent"
          />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {groups.map((group) => (
            <li key={group.id}>
              <Link href={`/groups/${group.slug}`}>
                <Card className="flex items-center gap-4 p-4 transition-shadow hover:shadow-float">
                  <GroupAvatar name={group.name} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 truncate text-[15px] font-semibold">
                      {group.name}
                      {group.privacy === "PRIVATE" ? <Lock className="size-3.5 text-muted-foreground" aria-label={t("groups.private")} /> : null}
                    </span>
                    <span className="block text-[12.5px] text-muted-foreground">
                      {group.privacy === "PRIVATE" ? t("groups.private") : t("groups.public")} · {t("groups.members", { count: group.memberCount })}
                    </span>
                  </span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <CreateGroupDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
