"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";

export function FollowButton({
  userId,
  initialFollowing,
  compact = false,
  onChange,
}: {
  readonly userId: string;
  readonly initialFollowing: boolean;
  readonly compact?: boolean;
  readonly onChange?: (following: boolean) => void;
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
      onChange?.(!previous);
    } catch {
      setFollowing(previous);
      toast.error(t("feedback.error.body"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button type="button" variant={following ? "secondary" : "primary"} size={compact ? "sm" : "md"} disabled={busy} onClick={() => void toggle()}>
      {following ? (compact ? <Check className="size-4" aria-label={t("profile.public.unfollow")} /> : t("profile.public.unfollow")) : t("profile.public.follow")}
    </Button>
  );
}
