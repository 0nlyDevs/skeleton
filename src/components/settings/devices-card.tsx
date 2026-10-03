"use client";

import { Laptop, Loader2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormatters } from "@/hooks/use-formatters";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import type { KnownDeviceDto } from "@/modules/devices/devices.service";

/**
 * F54 — the devices this account has signed in from. A sign-in from a device
 * that is not on this list raises the "is it you?" alert; forgetting a device
 * makes its next sign-in alert again.
 */
export function DevicesCard() {
  const t = useTranslation();
  const fmt = useFormatters();
  const [devices, setDevices] = useState<KnownDeviceDto[] | null>(null);
  const [forgetting, setForgetting] = useState<KnownDeviceDto | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setDevices((await apiFetch<{ data: KnownDeviceDto[] }>("/api/users/me/devices")).data);
    } catch {
      setDevices([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const forget = async () => {
    if (!forgetting) return;
    setBusy(true);
    try {
      await apiFetch(`/api/users/me/devices/${encodeURIComponent(forgetting.id)}`, { method: "DELETE" });
      toast.success(t("security.devices.forgotten"));
      setForgetting(null);
      await load();
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card id="devices-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Laptop className="size-4 text-muted-foreground" aria-hidden />
          {t("security.devices.title")}
        </CardTitle>
        <CardDescription>{t("security.devices.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {devices === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t("common.loading")}
          </p>
        ) : devices.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("security.devices.empty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border/70 rounded-xl border border-border/70">
            {devices.map((device) => (
              <li key={device.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    {device.label}
                    {device.current ? <Badge variant="success">{t("security.devices.current")}</Badge> : null}
                  </span>
                  <span className="text-[0.75rem] text-muted-foreground">
                    {t("security.devices.seen", { first: fmt.date(device.firstSeenAt), last: fmt.relative(device.lastSeenAt) })}
                  </span>
                </div>
                {device.current ? null : (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setForgetting(device)} aria-label={t("security.devices.forget_label", { name: device.label })}>
                    <Trash2 aria-hidden />
                    {t("security.devices.forget")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <ConfirmDialog
        open={forgetting !== null}
        onOpenChange={(open) => (open ? null : setForgetting(null))}
        title={t("security.devices.forget_title", { name: forgetting?.label ?? "" })}
        description={t("security.devices.forget_body")}
        confirmLabel={t("security.devices.forget")}
        busy={busy}
        onConfirm={() => void forget()}
      />
    </Card>
  );
}
