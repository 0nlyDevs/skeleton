"use client";

import { Check, Copy, Download, Loader2, ShieldCheck } from "lucide-react";
import QRCode from "qrcode";
import { useState } from "react";
import { brand } from "@/lib/brand";
import { toast } from "sonner";

import { FormField } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";

type Intent = "enable" | "disable" | "codes";

/** The secret part of an `otpauth://` URI, for manual entry. */
function secretOf(uri: string): string | null {
  try {
    return new URL(uri).searchParams.get("secret");
  } catch {
    return null;
  }
}

function errorText(error: { status?: number; code?: string } | null | undefined, t: ReturnType<typeof useTranslation>): string {
  if (!error) return t("errors.server");
  if (error.status === 429) return t("errors.rate_limited");
  const code = (error.code ?? "").toUpperCase();
  if (code.includes("PASSWORD") || error.status === 400 || error.status === 401) return t("twofa.wrong_password");
  return t("errors.server");
}

/**
 * Two-factor authentication, done properly: every change re-proves the
 * password (step-up), the secret only becomes active after a correct first
 * code, and recovery codes are shown once with copy/download.
 */
export function TwoFactorCard({ enabled: initial, hasPassword }: { readonly enabled: boolean; readonly hasPassword: boolean }) {
  const t = useTranslation();
  const [enabled, setEnabled] = useState(initial);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<{ uri: string; qr: string | null; codes: string[] } | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[]>([]);

  const confirmIdentity = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password) {
      setPasswordError(t("password.required"));
      return;
    }
    setBusy(true);
    setPasswordError(null);
    try {
      if (intent === "enable") {
        const result = await authClient.twoFactor.enable({ password });
        if (result.error) {
          setPasswordError(errorText(result.error, t));
          return;
        }
        const data = result.data as { totpURI?: string; backupCodes?: string[] };
        const uri = data.totpURI ?? "";
        let qr: string | null = null;
        try {
          qr = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
        } catch {
          qr = null;
        }
        setSetup({ uri, qr, codes: data.backupCodes ?? [] });
      } else if (intent === "disable") {
        const result = await authClient.twoFactor.disable({ password });
        if (result.error) {
          setPasswordError(errorText(result.error, t));
          return;
        }
        setEnabled(false);
        toast.success(t("settings.security.twofa_disabled"));
      } else if (intent === "codes") {
        const result = await authClient.twoFactor.generateBackupCodes({ password });
        if (result.error) {
          setPasswordError(errorText(result.error, t));
          return;
        }
        setCodes(result.data?.backupCodes ?? []);
      }
      setIntent(null);
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (code.length !== 6) {
      setCodeError(t("auth.twofa.invalid"));
      return;
    }
    setBusy(true);
    setCodeError(null);
    try {
      const result = await authClient.twoFactor.verifyTotp({ code });
      if (result.error) {
        setCodeError(result.error.status === 429 ? t("errors.rate_limited") : t("auth.twofa.invalid"));
        return;
      }
      setEnabled(true);
      setCodes(setup?.codes ?? []);
      setSetup(null);
      setCode("");
      toast.success(t("settings.security.twofa_enabled"));
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    const blob = new Blob([`${brand.name} — backup codes\n\n${codes.join("\n")}\n`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "skeleton-backup-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-muted-foreground" />
          {t("settings.security.twofa")}
          <Badge variant={enabled ? "success" : "neutral"} className="ml-1">
            {enabled ? t("settings.security.twofa_on") : t("settings.security.twofa_off")}
          </Badge>
        </CardTitle>
        <CardDescription>{t("settings.security.twofa_backup_hint")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!hasPassword ? (
          <p className="text-[13px] text-muted-foreground">{t("twofa.need_password")}</p>
        ) : setup ? (
          <form onSubmit={(event) => void verify(event)} className="flex max-w-md flex-col gap-4" noValidate>
            <p className="text-[13.5px] leading-relaxed">{t("twofa.scan")}</p>
            <div className="flex flex-wrap items-start gap-4 rounded-xl bg-surface-muted p-4">
              {setup.qr ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URL produced locally by `qrcode`
                <img src={setup.qr} alt="QR code" className="size-44 rounded-lg bg-white p-2" />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] text-muted-foreground">{t("twofa.manual")}</p>
                <code className="mt-1 block break-all rounded-md bg-surface px-2 py-1.5 font-mono text-[13px]">{secretOf(setup.uri) ?? setup.uri}</code>
              </div>
            </div>
            <FormField label={t("twofa.code")} required {...(codeError ? { error: codeError } : {})}>
              {(props) => (
                <Input
                  {...props}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  className="w-40 text-center font-mono tracking-[0.3em]"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                  autoFocus
                />
              )}
            </FormField>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : null}
                {t("twofa.verify")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setSetup(null)}>
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        ) : enabled ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setIntent("codes")}>
              {t("twofa.regenerate")}
            </Button>
            <Button variant="destructive" onClick={() => setIntent("disable")}>
              {t("twofa.disable")}
            </Button>
          </div>
        ) : (
          <Button className="w-fit" onClick={() => setIntent("enable")}>
            {t("twofa.enable")}
          </Button>
        )}
      </CardContent>

      <Dialog open={intent !== null} onOpenChange={(open) => { if (!open) { setIntent(null); setPassword(""); setPasswordError(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("twofa.confirm_identity")}</DialogTitle>
            <DialogDescription>{t("twofa.confirm_hint")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void confirmIdentity(event)} className="flex flex-col gap-4" noValidate>
            <FormField label={t("password.current")} required {...(passwordError ? { error: passwordError } : {})}>
              {(props) => <PasswordInput {...props} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus />}
            </FormField>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIntent(null)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : null}
                {t("twofa.continue")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={codes.length > 0} onOpenChange={(open) => !open && setCodes([])}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("twofa.codes_title")}</DialogTitle>
            <DialogDescription>{t("twofa.codes_hint")}</DialogDescription>
          </DialogHeader>
          <ul className="grid grid-cols-2 gap-2 rounded-xl bg-surface-muted p-4 font-mono text-[14px]">
            {codes.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="secondary" onClick={() => void navigator.clipboard.writeText(codes.join("\n")).then(() => toast.success(t("common.copied")))}>
              <Copy />
              {t("common.copy")}
            </Button>
            <Button variant="secondary" onClick={download}>
              <Download />
              .txt
            </Button>
            <Button onClick={() => setCodes([])}>
              <Check />
              {t("common.done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
