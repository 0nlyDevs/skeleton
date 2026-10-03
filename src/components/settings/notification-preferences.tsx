"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiFetch, ApiRequestError } from "@/lib/api/client";
import type { MessageKey } from "@/lib/i18n";

export interface NotificationPreferencesShape {
  readonly emailOnMessage: boolean;
  readonly emailOnMention: boolean;
  readonly emailOnSystem: boolean;
}

/**
 * Notification preferences.
 *
 * Each switch maps to one column in `NotificationPreference`; flipping one saves
 * just that field. The optimistic update keeps the toggle instant, and the toast
 * confirms the server agreed — the same pattern as the bell's mark-as-read.
 */
export function NotificationPreferences({
  initial,
}: {
  readonly initial: NotificationPreferencesShape;
}) {
  const t = useTranslation();

  const [prefs, setPrefs] = useState(initial);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const update = async (key: keyof NotificationPreferencesShape, value: boolean) => {
    const previous = prefs;
    setPrefs((current) => ({ ...current, [key]: value }));
    setSavingKey(key);

    try {
      await apiFetch("/api/notifications/preferences", {
        method: "PATCH",
        body: { [key]: value },
      });
      toast.success(t("settings.notifications.saved"));
    } catch (caught) {
      setPrefs(previous);
      toast.error(
        caught instanceof ApiRequestError
          ? t(`error.${caught.code}` as MessageKey)
          : t("feedback.error.body"),
      );
    } finally {
      setSavingKey(null);
    }
  };

  const rows = [
    { key: "emailOnMessage" as const, label: t("settings.notifications.email_message") },
    { key: "emailOnMention" as const, label: t("settings.notifications.email_mention") },
    { key: "emailOnSystem" as const, label: t("settings.notifications.email_system") },
  ];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[1.5rem] font-semibold tracking-[-0.015em]">
          {t("settings.notifications.title")}
        </h1>
        <p className="text-[0.875rem] text-muted-foreground">{t("settings.notifications.subtitle")}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.notifications.title")}</CardTitle>
          <CardDescription>{t("settings.notifications.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y divide-border/60">
            {rows.map((row) => (
              <li key={row.key} className="flex items-center justify-between gap-4 py-3.5">
                <Label htmlFor={row.key} className="cursor-pointer text-[0.8438rem] font-normal">
                  {row.label}
                </Label>
                <Switch
                  id={row.key}
                  checked={prefs[row.key]}
                  disabled={savingKey !== null}
                  onCheckedChange={(value) => void update(row.key, value)}
                />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
