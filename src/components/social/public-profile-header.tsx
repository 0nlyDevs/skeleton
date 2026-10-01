"use client";

import { MessageCircle, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FollowButton } from "@/components/social/follow-button";
import { ReportContentButton } from "@/components/social/report-content-button";
import { apiFetch } from "@/lib/api/client";
import type { PublicProfileDto } from "@/modules/follows/follows.dto";
import type { AuthUser } from "@/types";

export function PublicProfileHeader({ profile, viewer }: { readonly profile: PublicProfileDto; readonly viewer: AuthUser | null }) {
  const t = useTranslation();
  const router = useRouter();
  const [messaging, setMessaging] = useState(false);
  const ownProfile = viewer?.id === profile.id;

  const startMessage = async () => {
    if (!viewer) {
      router.push("/login");
      return;
    }
    if (messaging) return;
    setMessaging(true);
    try {
      const response = await apiFetch<{ data: { id: string } }>("/api/messages/rooms", {
        method: "POST",
        body: { type: "DIRECT", targetUserId: profile.id },
      });
      router.push(`/chat?room=${encodeURIComponent(response.data.id)}`);
    } catch {
      toast.error(t("feedback.error.body"));
      setMessaging(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="h-2 bg-primary/70" />
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:p-6">
        <Avatar className="size-20 shrink-0 border-4 border-card shadow-sm">
          <AvatarImage src={profile.image ?? undefined} alt="" />
          <AvatarFallback><UserRound className="size-8" /></AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{profile.name}</h1>
          <p className="text-sm text-muted-foreground">@{profile.displayUsername ?? profile.username}</p>
          {profile.bio ? <p className="mt-3 max-w-prose whitespace-pre-line break-words text-sm leading-relaxed">{profile.bio}</p> : null}
          <p className="mt-3 text-xs text-muted-foreground">{t("profile.public.joined", { date: profile.createdAt.slice(0, 10) })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ownProfile ? <Button variant="secondary" onClick={() => router.push("/settings/profile")}>{t("profile.public.edit")}</Button> : (
            <>
              {viewer ? <FollowButton userId={profile.id} initialFollowing={profile.isFollowing} /> : <Button asChild><Link href="/login">{t("profile.public.follow")}</Link></Button>}
              <Button variant="secondary" disabled={messaging} onClick={() => void startMessage()}><MessageCircle />{t("profile.public.message")}</Button>
              <ReportContentButton targetType="user" targetId={profile.id} signedIn={Boolean(viewer)} label={t("profile.public.report")} />
            </>
          )}
        </div>
      </div>
      <div className="flex gap-5 border-t border-border/70 px-5 py-3 text-sm sm:px-6">
        <span><strong>{profile.followerCount}</strong> <span className="text-muted-foreground">{t("profile.public.followers")}</span></span>
        <span><strong>{profile.followingCount}</strong> <span className="text-muted-foreground">{t("profile.public.following")}</span></span>
      </div>
    </Card>
  );
}
