"use client";

import { Info, MoreHorizontal } from "lucide-react";
import Link from "@/components/ui/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { UserAvatar } from "@/components/shell/user-avatar";

import { GroupRoleBadge, ROLE_STYLE } from "./group-role-badge";
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
          {members.map((member, index) => {
            // The roster comes sorted by role: a heading opens each role's section.
            const section = status === "ACTIVE" && members[index - 1]?.role !== member.role ? member.role : null;
            const actable = manager && member.user.id !== viewerId && member.role !== "OWNER" && RANK[member.role] < myRank;
            return (
              <li key={member.user.id} className="flex flex-col">
                {section ? (
                  <h3 className="flex items-center gap-1.5 pb-1 pt-3 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground first:pt-0">
                    {t(`groups.section.${section}` as MessageKey)}
                  </h3>
                ) : null}
                <div className="flex items-center gap-3 py-2.5">
                <UserAvatar userId={member.user.id} name={member.user.name} image={member.user.image} size="sm" />
                <Link href={member.user.username ? `/profile/${member.user.username}` : "#"} className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{member.user.name}</span>
                  {member.user.username ? <span className="block truncate text-[12px] text-muted-foreground">@{member.user.username}</span> : null}
                </Link>
                {status === "ACTIVE" ? <GroupRoleBadge role={member.role} /> : null}
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
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <details className="mt-4 rounded-xl bg-surface-muted/60 px-3 py-2 text-[13px]">
        <summary className="flex cursor-pointer items-center gap-1.5 font-semibold text-muted-foreground">
          <Info className="size-4" aria-hidden />
          {t("groups.roles_guide")}
        </summary>
        <dl className="mt-2 flex flex-col gap-2 pb-1">
          {(["OWNER", "ADMIN", "MODERATOR", "MEMBER"] as const).map((role) => (
            <div key={role} className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-3">
              <dt className="w-32 shrink-0">
                {role === "MEMBER" ? (
                  <span className="text-[12px] font-semibold">{t("groups.role.MEMBER")}</span>
                ) : (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${ROLE_STYLE[role].className}`}>
                    {t(`groups.role.${role}` as MessageKey)}
                  </span>
                )}
              </dt>
              <dd className="text-muted-foreground">{t(`groups.role_can.${role}` as MessageKey)}</dd>
            </div>
          ))}
        </dl>
      </details>
    </Card>
  );
}
