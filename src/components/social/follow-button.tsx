"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";

export function FollowButton({
  userId,
  initialFollowing,
  compact = false,
}: {
  readonly userId: string;
  readonly initialFollowing: boolean;
  readonly compact?: boolean;
}) {
  const t = useTranslation();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    const previous = following;
    setFollowing(!previous);
    setBusy(true);
    try {
      await apiFetch(`/api/users/${encodeURIComponent(userId)}/follow`, {
        method: previous ? "DELETE" : "PUT",
      });
    } catch {
      setFollowing(previous);
      toast.error(t("feedback.error.body"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button type="button" variant={following ? "secondary" : "primary"} size={compact ? "sm" : "md"} disabled={busy} onClick={() => void toggle()}>
      {following ? t("profile.public.unfollow") : t("profile.public.follow")}
    </Button>
  );
}
