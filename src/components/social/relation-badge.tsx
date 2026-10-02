"use client";

import { UserCheck, UsersRound } from "lucide-react";

import { useTranslation } from "@/components/providers/i18n-provider";

/** "Amis" when both follow each other, else "Vous suit" when they follow you. */
export function RelationBadge({ isFriend, followsYou }: { readonly isFriend: boolean; readonly followsYou: boolean }) {
  const t = useTranslation();
  if (isFriend) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[11px] font-semibold text-success">
        <UsersRound className="size-3" aria-hidden />
        {t("connections.friends")}
      </span>
    );
  }
  if (followsYou) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        <UserCheck className="size-3" aria-hidden />
        {t("connections.follows_you")}
      </span>
    );
  }
  return null;
}
