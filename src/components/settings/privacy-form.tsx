"use client";

import { Eye } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { resetAutoLocationSetting } from "@/hooks/use-auto-location";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import type { MessageKey } from "@/lib/i18n";

type Setting = "showPresence" | "autoLocation";

const LABELS: Record<Setting, { label: MessageKey; hint: MessageKey }> = {
  showPresence: { label: "settings.privacy.presence", hint: "settings.privacy.presence_hint" },
  autoLocation: { label: "settings.privacy.auto_location", hint: "settings.privacy.auto_location_hint" },
};

export function PrivacyForm(initial: { readonly showPresence: boolean; readonly autoLocation: boolean }) {
  const t = useTranslation();
  const [values, setValues] = useState<Record<Setting, boolean>>({ showPresence: initial.showPresence, autoLocation: initial.autoLocation });
  const [busy, setBusy] = useState<Setting | null>(null);

  const toggle = async (setting: Setting, value: boolean) => {
    setValues((current) => ({ ...current, [setting]: value }));
    setBusy(setting);
    try {
      await apiFetch("/api/users/me", { method: "PATCH", body: { [setting]: value } });
      if (setting === "autoLocation") resetAutoLocationSetting();
      toast.success(t("settings.profile.saved"));
    } catch (error) {
      setValues((current) => ({ ...current, [setting]: !value }));
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(null);
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
      <CardContent className="flex flex-col gap-5">
        {(Object.keys(LABELS) as Setting[]).map((setting) => (
          <label key={setting} className="flex items-start justify-between gap-4">
            <span>
              <span className="block text-[0.875rem] font-medium">{t(LABELS[setting].label)}</span>
              <span className="mt-0.5 block text-[0.7812rem] leading-relaxed text-muted-foreground">{t(LABELS[setting].hint)}</span>
            </span>
            <Switch checked={values[setting]} disabled={busy === setting} onCheckedChange={(value) => void toggle(setting, value)} aria-label={t(LABELS[setting].label)} />
          </label>
        ))}
      </CardContent>
    </Card>
  );
}
