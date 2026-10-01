"use client";

import { CalendarDays, Check, Globe, Lock, LogOut, Settings, ShieldBan, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { FeedView } from "@/components/social/feed-view";
import type { FeedPageResponse } from "@/components/social/use-feed";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { formatLongDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { GroupDto } from "@/modules/groups/groups.dto";

import { GroupAvatar } from "./group-avatar";
import { GroupMembers } from "./group-members";
import { GroupSettingsDialog } from "./group-settings-dialog";

type Tab = "discussion" | "members" | "about";

export function GroupView({
  group: initial,
  initialFeed,
  viewer,
  initialTab = "discussion",
}: {
  readonly group: GroupDto;
  readonly initialFeed: FeedPageResponse | null;
  readonly viewer: { id: string; name: string; image: string | null; isPlatformAdmin: boolean } | null;
  readonly initialTab?: Tab;
}) {
  const t = useTranslation();
  const router = useRouter();
  const [group, setGroup] = useState(initial);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState(false);
  const access = group.viewer;

  const join = async () => {
    setBusy(true);
    try {
      const response = await apiFetch<{ data: GroupDto }>(`/api/groups/${group.slug}/membership`, { method: "PUT" });
      setGroup(response.data);
      router.refresh();
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    setBusy(true);
    try {
      await apiFetch(`/api/groups/${group.slug}/membership`, { method: "DELETE" });
      router.refresh();
      setGroup({ ...group, memberCount: Math.max(0, group.memberCount - (access.isMember ? 1 : 0)), viewer: { ...access, isMember: false, status: null, role: null, canPost: false } });
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(false);
    }
  };

  const membershipButton = () => {
    if (!viewer) {
      return (
        <Button asChild>
          <Link href={`/login?next=/groups/${group.slug}`}>{group.privacy === "PUBLIC" ? t("groups.join") : t("groups.request")}</Link>
        </Button>
      );
    }
    if (access.status === "BANNED") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-error/10 px-3 py-2 text-[13px] font-medium text-error">
          <ShieldBan className="size-4" /> {t("groups.banned")}
        </span>
      );
    }
    if (access.status === "PENDING") {
      return (
        <Button variant="secondary" onClick={() => void leave()} disabled={busy}>
          {t("groups.requested")}
        </Button>
      );
    }
    if (access.isMember) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary">
              <Check />
              {t("groups.joined")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" disabled={access.role === "OWNER"} onSelect={() => void leave()}>
              <LogOut />
              {t("groups.leave")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    return (
      <Button onClick={() => void join()} disabled={busy}>
        <UserPlus />
        {group.privacy === "PUBLIC" ? t("groups.join") : t("groups.request")}
      </Button>
    );
  };

  const tabs: Array<[Tab, string]> = [
    ["discussion", t("groups.discussion")],
    ...(access.canRead ? ([["members", t("groups.member_list")]] as Array<[Tab, string]>) : []),
    ["about", t("groups.about")],
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden">
        <div aria-hidden className="h-32 bg-gradient-to-br from-[oklch(0.62_0.2_310)] via-primary to-[oklch(0.7_0.14_210)] sm:h-44" />
        <div className="flex flex-wrap items-end gap-4 px-5 pb-4">
          <GroupAvatar name={group.name} size="lg" className="-mt-10 ring-4 ring-card" />
          <div className="min-w-0 flex-1 pt-3">
            <h1 className="truncate text-[24px] font-bold tracking-tight">{group.name}</h1>
            <p className="flex items-center gap-1.5 text-[13.5px] text-muted-foreground">
              {group.privacy === "PRIVATE" ? <Lock className="size-3.5" /> : <Globe className="size-3.5" />}
              {group.privacy === "PRIVATE" ? t("groups.private") : t("groups.public")} · {t("groups.members", { count: group.memberCount })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {access.canEditSettings ? (
              <Button variant="secondary" size="icon" aria-label={t("groups.settings")} onClick={() => setSettings(true)}>
                <Settings />
              </Button>
            ) : null}
            {membershipButton()}
          </div>
        </div>
        <div role="tablist" className="flex gap-1 border-t border-border/60 px-3">
          {tabs.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                "border-b-2 px-3 py-3 text-[14px] font-semibold transition-colors",
                tab === value ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      {tab === "discussion" ? (
        access.canRead && initialFeed ? (
          <FeedView
            initial={initialFeed}
            viewer={viewer}
            filter={{ group: { id: group.id, slug: group.slug } }}
            composer={access.canPost}
            composerGroup={{ id: group.id, name: group.name }}
            emptyTitle={t("groups.discussion")}
            emptyBody={t("groups.empty_feed")}
          />
        ) : (
          <Card className="flex flex-col items-center gap-2 p-10 text-center">
            <Lock className="size-8 text-muted-foreground" />
            <h2 className="text-[17px] font-semibold">{t("groups.locked_title")}</h2>
            <p className="max-w-sm text-[13.5px] text-muted-foreground">{t("groups.locked_body")}</p>
          </Card>
        )
      ) : null}

      {tab === "members" && access.canRead ? (
        <GroupMembers group={group} viewerId={viewer?.id ?? null} isPlatformAdmin={viewer?.isPlatformAdmin ?? false} />
      ) : null}

      {tab === "about" ? (
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="text-[16px] font-semibold">{t("groups.about")}</h2>
          <p className="whitespace-pre-line text-[14.5px] leading-relaxed">{group.description || "—"}</p>
          <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            {group.privacy === "PRIVATE" ? <Lock className="size-4" /> : <Globe className="size-4" />}
            {group.privacy === "PRIVATE" ? t("groups.private_hint") : t("groups.public_hint")}
          </p>
          <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <CalendarDays className="size-4" />
            {t("groups.created_on", { date: formatLongDate(group.createdAt) })}
          </p>
        </Card>
      ) : null}

      {access.canEditSettings ? <GroupSettingsDialog group={group} open={settings} onOpenChange={setSettings} onSaved={setGroup} /> : null}
    </div>
  );
}
