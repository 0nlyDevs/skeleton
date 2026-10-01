"use client";

import { Loader2, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";

/** Landing banner for the "new sign-in" alert link: one click locks everyone else out. */
export function SecurityAlert({ onSecured }: { readonly onSecured: () => void }) {
  const t = useTranslation();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const secure = async () => {
    setBusy(true);
    try {
      await apiFetch("/api/users/me/sessions", { method: "DELETE" });
      setDone(true);
      toast.success(t("security.alert.done"));
      onSecured();
      document.getElementById("password-card")?.scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Alert variant="error">
      <ShieldAlert />
      <AlertDescription className="flex flex-col gap-2 text-foreground">
        <span className="font-semibold">{t("security.alert.title")}</span>
        <span>{done ? t("security.alert.done") : t("security.alert.body")}</span>
        {!done ? (
          <Button variant="destructive" size="sm" className="w-fit" onClick={() => void secure()} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            {t("security.alert.action")}
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
