"use client";

import { MoreHorizontal, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { UserAvatar } from "@/components/shell/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { GroupDto, GroupMemberDto } from "@/modules/groups/groups.dto";

const RANK = { MEMBER: 0, MODERATOR: 1, ADMIN: 2, OWNER: 3 } as const;

type Status = "ACTIVE" | "PENDING" | "BANNED";
type Action = { action: "approve" | "reject" | "remove" | "ban" | "unban" } | { action: "role"; role: "ADMIN" | "MODERATOR" | "MEMBER" };

/**
 * Member roster; managers also get requests and bans. Menus only offer what
 * the viewer's rank allows, and the server re-checks every action.
 */
export function GroupMembers({ group, viewerId, isPlatformAdmin }: { readonly group: GroupDto; readonly viewerId: string | null; readonly isPlatformAdmin: boolean }) {
  const t = useTranslation();
  const manager = group.viewer.canManageMembers;
  const [status, setStatus] = useState<Status>("ACTIVE");
  const [members, setMembers] = useState<GroupMemberDto[] | null>(null);
  const myRank = isPlatformAdmin ? RANK.OWNER : group.viewer.isMember && group.viewer.role ? RANK[group.viewer.role] : -1;

  const load = useCallback(async () => {
    setMembers(null);
    try {
      const response = await apiFetch<{ data: GroupMemberDto[] }>(`/api/groups/${group.slug}/members?status=${status}`);
      setMembers(response.data);
    } catch (error) {
      toast.error(describeApiError(error, t));
      setMembers([]);
    }
  }, [group.slug, status, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (member: GroupMemberDto, body: Action) => {
    try {
      await apiFetch(`/api/groups/${group.slug}/members/${encodeURIComponent(member.user.id)}`, { method: "PATCH", body });
      void load();
    } catch (error) {
      toast.error(describeApiError(error, t));
    }
  };

  const tabs: Array<[Status, MessageKey]> = [["ACTIVE", "groups.member_list"], ...(manager ? ([["PENDING", "groups.requests"], ["BANNED", "groups.banned_list"]] as Array<[Status, MessageKey]>) : [])];

  return (
    <Card className="p-4">
      {tabs.length > 1 ? (
        <div role="tablist" className="mb-3 flex gap-1">
          {tabs.map(([value, key]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={status === value}
              onClick={() => setStatus(value)}
              className={cn("rounded-full px-3 py-1.5 text-[13px] font-semibold", status === value ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-surface-muted")}
            >
              {t(key)}
            </button>
          ))}
        </div>
      ) : null}

      {members === null ? (
        <div className="flex flex-col gap-2">{[0, 1, 2].map((index) => <Skeleton key={index} className="h-12 rounded-xl" />)}</div>
      ) : members.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">{status === "PENDING" ? t("groups.no_requests") : "—"}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/60">
          {members.map((member) => {
            const actable = manager && member.user.id !== viewerId && member.role !== "OWNER" && RANK[member.role] < myRank;
            return (
              <li key={member.user.id} className="flex items-center gap-3 py-2.5">
                <UserAvatar name={member.user.name} image={member.user.image} size="sm" />
                <Link href={member.user.username ? `/profile/${member.user.username}` : "#"} className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{member.user.name}</span>
                  {member.user.username ? <span className="block truncate text-[12px] text-muted-foreground">@{member.user.username}</span> : null}
                </Link>
                {member.role !== "MEMBER" && status === "ACTIVE" ? (
                  <Badge variant={member.role === "OWNER" ? "primary" : "neutral"}>
                    <ShieldCheck className="size-3" />
                    {t(`groups.role.${member.role}` as MessageKey)}
                  </Badge>
                ) : null}
                {status === "PENDING" && actable ? (
                  <div className="flex gap-1.5">
                    <Button size="sm" onClick={() => void act(member, { action: "approve" })}>{t("groups.approve")}</Button>
                    <Button size="sm" variant="secondary" onClick={() => void act(member, { action: "reject" })}>{t("groups.reject")}</Button>
                  </div>
                ) : null}
                {status === "BANNED" && actable ? (
                  <Button size="sm" variant="secondary" onClick={() => void act(member, { action: "unban" })}>{t("groups.unban")}</Button>
                ) : null}
                {status === "ACTIVE" && actable ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger aria-label={t("groups.manage")} className="grid size-8 place-items-center rounded-full hover:bg-surface-muted">
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {myRank > RANK.ADMIN && member.role !== "ADMIN" ? (
                        <DropdownMenuItem onSelect={() => void act(member, { action: "role", role: "ADMIN" })}>{t("groups.make_admin")}</DropdownMenuItem>
                      ) : null}
                      {myRank > RANK.MODERATOR && member.role !== "MODERATOR" ? (
                        <DropdownMenuItem onSelect={() => void act(member, { action: "role", role: "MODERATOR" })}>{t("groups.make_moderator")}</DropdownMenuItem>
                      ) : null}
                      {member.role !== "MEMBER" ? (
                        <DropdownMenuItem onSelect={() => void act(member, { action: "role", role: "MEMBER" })}>{t("groups.make_member")}</DropdownMenuItem>
                      ) : null}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => void act(member, { action: "remove" })}>{t("groups.remove")}</DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onSelect={() => void act(member, { action: "ban" })}>{t("groups.ban")}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
