"use client";

import { Ban, CalendarDays, Flag, MessageCircle, MoreHorizontal, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "@/components/ui/link";
import { useMemo, useState } from "react";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useTranslation } from "@/components/providers/i18n-provider";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { useFormatters } from "@/hooks/use-formatters";
import { UserAvatar } from "@/components/shell/user-avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePresence } from "@/hooks/use-presence";
import { formatLongDate } from "@/lib/format";
import type { PublicProfileDto } from "@/modules/follows/follows.dto";

import { ConnectionsDialog } from "./connections-dialog";
import { FollowButton } from "./follow-button";
import { RelationBadge } from "./relation-badge";
import { ReportDialog } from "./report-dialog";

/**
 * The public face of an account: what anyone sees. It never shows settings,
 * email or birth date — those live in /settings and in the owner's DTO only.
 */
export function ProfileHeader({ profile, signedIn }: { readonly profile: PublicProfileDto; readonly signedIn: boolean }) {
  const t = useTranslation();
  const fmt = useFormatters();
  const [reporting, setReporting] = useState(false);
  const ids = useMemo(() => (signedIn ? [profile.id] : []), [signedIn, profile.id]);
  const presence = usePresence(ids).get(profile.id);
  const [followers, setFollowers] = useState(profile.followerCount);
  const [connections, setConnections] = useState<"followers" | "following" | null>(null);
  const [blocked, setBlocked] = useState(profile.viewerBlocked === true);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const router = useRouter();

  const toggleBlock = async () => {
    try {
      await apiFetch(`/api/users/${encodeURIComponent(profile.id)}/block`, { method: blocked ? "DELETE" : "PUT" });
      setBlocked(!blocked);
      toast.success(t(blocked ? "block.unblocked" : "block.blocked"));
      router.refresh();
    } catch (error) {
      toast.error(describeApiError(error, t));
    }
  };

  return (
    <Card className="overflow-hidden">
      {profile.banner ? (
        // eslint-disable-next-line @next/next/no-img-element -- the owner's public banner upload
        <img src={profile.banner} alt="" loading="lazy" className="eco-hide h-36 w-full object-cover sm:h-48" />
      ) : (
        <div aria-hidden className="h-36 bg-gradient-to-br from-primary via-[oklch(0.6_0.2_300)] to-[oklch(0.72_0.15_200)] sm:h-48" />
      )}
      <div className="px-5 pb-5">
        <div className="-mt-14 flex flex-wrap items-end justify-between gap-3">
          <UserAvatar userId={profile.id} name={profile.name} image={profile.image} size="xl" {...(signedIn ? { online: presence?.online ?? false } : {})} />
          <div className="flex flex-wrap items-center gap-2 pb-1">
            {profile.isSelf ? (
              <Button asChild variant="secondary">
                <Link href="/settings/profile">
                  <Pencil />
                  {t("profile.public.edit")}
                </Link>
              </Button>
            ) : signedIn ? (
              <>
                {blocked ? (
                  <span className="rounded-lg bg-error/10 px-3 py-2 text-[13px] font-medium text-error">{t("block.you_blocked")}</span>
                ) : (
                <>
                <FollowButton
                  userId={profile.id}
                  initialFollowing={profile.isFollowing}
                  onChange={(following) => setFollowers((count) => count + (following ? 1 : -1))}
                />
                <Button asChild variant="secondary">
                  <Link href={`/messages?to=${encodeURIComponent(profile.id)}`}>
                    <MessageCircle />
                    {t("profile.public.message")}
                  </Link>
                </Button>
                </>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger aria-label={t("common.more")} className="grid size-10 place-items-center rounded-lg border border-border hover:bg-surface-muted">
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setReporting(true)}>
                      <Flag />
                      {t("profile.public.report")}
                    </DropdownMenuItem>
                    <DropdownMenuItem variant={blocked ? "default" : "destructive"} onSelect={() => (blocked ? void toggleBlock() : setConfirmBlock(true))}>
                      <Ban />
                      {blocked ? t("block.unblock") : t("block.block")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Button asChild>
                <Link href="/login">{t("profile.public.follow")}</Link>
              </Button>
            )}
          </div>
        </div>

        <h1 className="mt-3 flex flex-wrap items-center gap-2 text-[24px] font-bold tracking-tight">
          {profile.name}
          {!profile.isSelf ? <RelationBadge isFriend={profile.isFriend} followsYou={profile.followsYou} /> : null}
        </h1>
        <p className="text-[14px] text-muted-foreground">
          @{profile.username}
          {signedIn && presence ? (
            <span className={presence.online ? "ml-2 text-success" : "ml-2"}>
              · {presence.online ? t("contacts.online") : presence.lastSeenAt ? t("contacts.last_seen", { time: fmt.relative(presence.lastSeenAt) }) : null}
            </span>
          ) : null}
        </p>
        <p className="mt-3 whitespace-pre-line text-[14.5px] leading-relaxed">{profile.bio || <span className="text-muted-foreground">{t("profile.public.no_bio")}</span>}</p>
        <p className="mt-3 flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <CalendarDays className="size-4" />
          {t("profile.public.joined", { date: formatLongDate(profile.createdAt) })}
        </p>
        <dl className="mt-4 flex gap-6">
          <div className="flex items-baseline gap-1.5">
            <dd className="text-[16px] font-bold tabular-nums">{profile.postCount}</dd>
            <dt className="text-[13px] text-muted-foreground">{t("profile.public.posts")}</dt>
          </div>
          {(
            [
              ["followers", "profile.public.followers", followers],
              ["following", "profile.public.following", profile.followingCount],
            ] as const
          ).map(([kind, key, value]) => (
            <button
              key={kind}
              type="button"
              onClick={() => setConnections(kind)}
              className="flex items-baseline gap-1.5 rounded-md hover:underline"
              aria-haspopup="dialog"
            >
              <dd className="text-[16px] font-bold tabular-nums">{value}</dd>
              <dt className="text-[13px] text-muted-foreground">{t(key)}</dt>
            </button>
          ))}
        </dl>
        <ConnectionsDialog
          username={profile.username}
          open={connections !== null}
          onOpenChange={(open) => !open && setConnections(null)}
          initialKind={connections ?? "followers"}
          signedIn={signedIn}
        />
      </div>
      {signedIn && !profile.isSelf ? (
        <ConfirmDialog
          open={confirmBlock}
          onOpenChange={setConfirmBlock}
          title={t("block.confirm_title", { name: profile.name })}
          description={t("block.confirm_body")}
          confirmLabel={t("block.block")}
          onConfirm={() => void toggleBlock()}
        />
      ) : null}
      {signedIn && !profile.isSelf ? <ReportDialog open={reporting} onOpenChange={setReporting} targetType="user" targetId={profile.id} /> : null}
    </Card>
  );
}
