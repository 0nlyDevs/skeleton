"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { useFormatters } from "@/hooks/use-formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiFetch, ApiRequestError } from "@/lib/api/client";

export interface FeatureFlagDto {
  readonly key: string;
  readonly description: string | null;
  readonly enabled: boolean;
  readonly updatedAt: string;
}

/**
 * Feature flags.
 *
 * A flag exists so unfinished-but-prepared modules can ship dark. Toggling one is
 * an admin write: it hits the API, is audited (`feature_flag.toggled`), and the
 * optimistic switch reverts if the server disagrees.
 *
 * Only the toggle is editable here; keys and descriptions are deploy-time data
 * changed in code, not in a UI someone can fat-finger at 3am.
 */
export function AdminSettingsView({ flags }: { readonly flags: FeatureFlagDto[] }) {
  const t = useTranslation();
  const fmt = useFormatters();
  const [rows, setRows] = useState(flags);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const toggle = async (flag: FeatureFlagDto, enabled: boolean) => {
    setBusyKey(flag.key);
    const previous = rows;

    setRows((current) =>
      current.map((row) => (row.key === flag.key ? { ...row, enabled } : row)),
    );

    try {
      await apiFetch(`/api/admin/flags/${encodeURIComponent(flag.key)}`, {
        method: "PATCH",
        body: { enabled },
      });
      toast.success(t("common.save"));
    } catch (caught) {
      setRows(previous);
      toast.error(
        caught instanceof ApiRequestError ? t(`error.${caught.code}` as never) : t("feedback.error.body"),
      );
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[1.5rem] font-semibold tracking-[-0.015em]">{t("admin.settings.title")}</h1>
        <p className="text-[0.875rem] text-muted-foreground">{t("admin.settings.subtitle")}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.settings.flags")}</CardTitle>
          <CardDescription>{t("admin.settings.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-4 text-[0.8438rem] text-muted-foreground">-</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {rows.map((flag) => (
                <li key={flag.key} className="flex items-center justify-between gap-4 py-3.5">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <Label htmlFor={`flag-${flag.key}`} className="cursor-pointer font-mono text-[0.8125rem]">
                      {flag.key}
                    </Label>
                    {flag.description ? (
                      <span className="text-[0.7812rem] text-muted-foreground">{flag.description}</span>
                    ) : null}
                    <span className="text-[0.7188rem] text-muted-foreground/70">
                      {fmt.relative(flag.updatedAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={flag.enabled ? "success" : "neutral"}>
                      {flag.enabled ? "on" : "off"}
                    </Badge>
                    <Switch
                      id={`flag-${flag.key}`}
                      checked={flag.enabled}
                      disabled={busyKey !== null}
                      onCheckedChange={(value) => void toggle(flag, value)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>{t("admin.settings.health")}</CardTitle>
            <CardDescription>/api/health</CardDescription>
          </div>
          <Button asChild variant="secondary" size="sm">
            <a href="/api/health" target="_blank" rel="noreferrer">
              {t("common.download")} ↗
            </a>
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
            {t("admin.settings.health.database")} · {t("admin.settings.health.email")} ·{" "}
            {t("admin.settings.health.ai")} · {t("admin.settings.health.realtime")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
