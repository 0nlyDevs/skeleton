"use client";

import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";

/**
 * Landing banner for the "new sign-in" alert link. F54 — the resident answers
 * the question the alert asks: "yes, it was me" closes it (and is recorded);
 * "no" signs out every other session, forgets the unknown device and leads to
 * the password change.
 */
export function SecurityAlert({ deviceId, onSecured }: { readonly deviceId: string | null; readonly onSecured: () => void }) {
  const t = useTranslation();
  const [busy, setBusy] = useState<"yes" | "no" | null>(null);
  const [outcome, setOutcome] = useState<"confirmed" | "secured" | null>(null);

  const confirm = async () => {
    if (!deviceId) {
      setOutcome("confirmed");
      return;
    }
    setBusy("yes");
    try {
      await apiFetch(`/api/users/me/devices/${encodeURIComponent(deviceId)}/confirm`, { method: "POST" });
      setOutcome("confirmed");
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(null);
    }
  };

  const secure = async () => {
    setBusy("no");
    try {
      await apiFetch("/api/users/me/sessions", { method: "DELETE" });
      if (deviceId) await apiFetch(`/api/users/me/devices/${encodeURIComponent(deviceId)}`, { method: "DELETE" }).catch(() => undefined);
      setOutcome("secured");
      toast.success(t("security.alert.done"));
      onSecured();
      document.getElementById("password-card")?.scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(null);
    }
  };

  if (outcome === "confirmed") {
    return (
      <Alert>
        <CheckCircle2 />
        <AlertDescription className="text-foreground">{t("security.alert.confirmed")}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="error">
      <ShieldAlert />
      <AlertDescription className="flex flex-col gap-2 text-foreground">
        <span className="font-semibold">{t("security.alert.title")}</span>
        <span>{outcome === "secured" ? t("security.alert.done") : t("security.alert.question")}</span>
        {outcome === null ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => void confirm()} disabled={busy !== null}>
              {busy === "yes" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              {t("security.alert.it_was_me")}
            </Button>
            <Button variant="destructive" size="sm" onClick={() => void secure()} disabled={busy !== null}>
              {busy === "no" ? <Loader2 className="animate-spin" /> : null}
              {t("security.alert.action")}
            </Button>
          </div>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
