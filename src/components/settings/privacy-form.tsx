"use client";

import { Eye } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";

export function PrivacyForm({ showPresence: initial }: { readonly showPresence: boolean }) {
  const t = useTranslation();
  const [showPresence, setShowPresence] = useState(initial);
  const [busy, setBusy] = useState(false);

  const toggle = async (value: boolean) => {
    setShowPresence(value);
    setBusy(true);
    try {
      await apiFetch("/api/users/me", { method: "PATCH", body: { showPresence: value } });
      toast.success(t("settings.profile.saved"));
    } catch (error) {
      setShowPresence(!value);
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="size-4 text-muted-foreground" />
          {t("settings.tabs.privacy")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <label className="flex items-start justify-between gap-4">
          <span>
            <span className="block text-[14px] font-medium">{t("settings.privacy.presence")}</span>
            <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted-foreground">{t("settings.privacy.presence_hint")}</span>
          </span>
          <Switch checked={showPresence} disabled={busy} onCheckedChange={(value) => void toggle(value)} aria-label={t("settings.privacy.presence")} />
        </label>
      </CardContent>
    </Card>
  );
}
