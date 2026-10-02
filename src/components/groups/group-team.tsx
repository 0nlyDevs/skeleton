"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { UserAvatar } from "@/components/shell/user-avatar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import type { GroupMemberDto } from "@/modules/groups/groups.dto";

import { GroupRoleBadge } from "./group-role-badge";

/** Owner, admins and moderators: who runs the group, at a glance. */
export function GroupTeam({ slug, viewerId }: { readonly slug: string; readonly viewerId: string | null }) {
  const t = useTranslation();
  const [team, setTeam] = useState<GroupMemberDto[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    // The roster is sorted by role, so the staff are always in the first page.
    apiFetch<{ data: GroupMemberDto[] }>(`/api/groups/${slug}/members?status=ACTIVE&limit=30`)
      .then((response) => {
        if (!cancelled) setTeam(response.data.filter((member) => member.role !== "MEMBER"));
      })
      .catch(() => {
        if (!cancelled) setTeam([]);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (team !== null && team.length === 0) return null;

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div>
        <h2 className="text-[16px] font-semibold">{t("groups.team")}</h2>
        <p className="text-[13px] text-muted-foreground">{t("groups.team_hint")}</p>
      </div>
      {team === null ? (
        <div className="flex flex-col gap-2">
          {[0, 1].map((index) => (
            <Skeleton key={index} className="h-11 rounded-xl" />
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {team.map((member) => (
            <li key={member.user.id} className="flex items-center gap-3 rounded-xl px-1 py-1.5">
              <UserAvatar userId={member.user.id} name={member.user.name} image={member.user.image} size="sm" />
              <Link href={member.user.username ? `/profile/${member.user.username}` : "#"} className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">
                  {member.user.name}
                  {member.user.id === viewerId ? <span className="font-normal text-muted-foreground"> ({t("groups.you")})</span> : null}
                </span>
                {member.user.username ? <span className="block truncate text-[12px] text-muted-foreground">@{member.user.username}</span> : null}
              </Link>
              <GroupRoleBadge role={member.role} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
