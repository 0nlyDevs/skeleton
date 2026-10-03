"use client";

import { Download, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PasswordInput } from "@/components/forms/password-input";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";

/** RGPD: download everything, or delete the account for good. */
export function DataRightsCard({ hasPassword }: { readonly hasPassword: boolean }) {
  const t = useTranslation();
  const [exporting, setExporting] = useState(false);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportData = async () => {
    setExporting(true);
    try {
      const response = await fetch("/api/users/me/export", { credentials: "same-origin" });
      if (!response.ok) throw new Error(response.status === 429 ? t("errors.rate_limited") : t("errors.server"));
      const blob = await response.blob();
      const name = /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? "skeleton.json";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("errors.server"));
    } finally {
      setExporting(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/api/users/me/delete", { method: "POST", body: hasPassword ? { password } : { confirmUsername: username } });
      window.location.assign("/?deleted=1");
    } catch (caught) {
      setError(describeApiError(caught, t));
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("account.data_title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-md text-[0.8125rem] text-muted-foreground">{t("account.export_hint")}</p>
          <Button variant="secondary" onClick={() => void exportData()} disabled={exporting}>
            {exporting ? <Loader2 className="animate-spin" /> : <Download />}
            {t("account.export")}
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
          <p className="max-w-md text-[0.8125rem] text-muted-foreground">{t("account.delete_hint")}</p>
          <Button variant="secondary" className="text-error" onClick={() => setOpen(true)}>
            <Trash2 />
            {t("account.delete")}
          </Button>
        </div>
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("account.delete_title")}</DialogTitle>
            <DialogDescription>{t("account.delete_body")}</DialogDescription>
          </DialogHeader>
          {hasPassword ? (
            <label className="flex flex-col gap-1 text-[0.8125rem]">
              <span className="font-medium">{t("account.confirm_password")}</span>
              <PasswordInput value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
            </label>
          ) : (
            <label className="flex flex-col gap-1 text-[0.8125rem]">
              <span className="font-medium">{t("account.confirm_username")}</span>
              <Input value={username} onChange={(event) => setUsername(event.target.value)} />
            </label>
          )}
          {error ? <p role="alert" className="text-[0.8125rem] text-error">{error}</p> : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={() => void remove()} disabled={busy || (hasPassword ? !password : !username)}>
              {busy ? <Loader2 className="animate-spin" /> : <Trash2 />}
              {t("account.delete_forever")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
