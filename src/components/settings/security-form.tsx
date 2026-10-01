"use client";

import { Check, Copy, KeyRound, Monitor, ShieldCheck } from "lucide-react";
import QRCode from "qrcode";
import { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/forms/form-field";
import { PasswordRequirements, PasswordStrength } from "@/components/auth/password-strength";
import { isPasswordAcceptable } from "@/lib/auth/password-policy";
import { useTranslation } from "@/components/providers/i18n-provider";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth/client";
import { formatDateTime } from "@/lib/format";

interface SessionInfo {
  readonly token: string;
  readonly expiresAt: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly createdAt: string;
}

/**
 * Security settings.
 *
 * Three independent cards, each mapping to exactly one API surface:
 *
 *  * **Password** — BetterAuth's change endpoint; other sessions are revoked so a
 *    stolen cookie from another device stops working the moment the password does.
 *  * **2FA** — the enable flow runs entirely against BetterAuth: enable → scan →
 *    verify → backup codes shown once. The backup codes are displayed in a
 *    dialog, never stored client-side, and the dialog is acknowledged before it
 *    can be dismissed as "done".
 *  * **Sessions** — list + revoke, with the current session labelled so the user
 *    never revokes themselves by accident (and revoking it is refused client-side;
 *    the server would refuse too).
 */
export function SecurityForm({
  twoFactorEnabled: initialTwoFactor,
  sessions: initialSessions,
  currentSessionToken,
  googleEnabled,
}: {
  readonly twoFactorEnabled: boolean;
  readonly sessions: SessionInfo[];
  readonly currentSessionToken: string;
  readonly googleEnabled: boolean;
}) {
  const t = useTranslation();

  // --- password ---------------------------------------------------------------
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // --- 2FA --------------------------------------------------------------------
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(initialTwoFactor);
  const [setupUri, setSetupUri] = useState<string | null>(null);
  // Rendered from `setupUri` so the user scans an image instead of typing a
  // 60-character otpauth URL. Stays null when rendering fails; the URI text
  // below is the fallback, never removed.
  const [setupQr, setSetupQr] = useState<string | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disablePassword, setDisablePassword] = useState("");
  const [busy2fa, setBusy2fa] = useState(false);

  // --- sessions ---------------------------------------------------------------
  const [sessions, setSessions] = useState(initialSessions);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (changingPassword) return;
    setChangingPassword(true);

    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });

      if (result.error) {
        toast.error(
          result.error.status === 401
            ? t("auth.login.failed")
            : result.error.code === "PASSWORD_TOO_WEAK"
              ? t("auth.password.too_weak")
              : t("error.VALIDATION_ERROR"),
        );
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      toast.success(t("settings.security.changed"));
    } catch {
      toast.error(t("feedback.error.body"));
    } finally {
      setChangingPassword(false);
    }
  };

  const startTwoFactor = async () => {
    setBusy2fa(true);
    try {
      const result = await authClient.twoFactor.enable({ password: "" });
      if (result.error) {
        toast.error(t("settings.security.twofa_password_hint"));
        return;
      }
      const data = result.data as { totpURI?: string } | undefined;
      const uri = data?.totpURI ?? null;
      setSetupUri(uri);
      setSetupQr(null);
      if (uri) {
        try {
          setSetupQr(await QRCode.toDataURL(uri, { margin: 1, width: 200 }));
        } catch {
          // The URI text below remains the manual-entry fallback.
        }
      }
    } catch {
      toast.error(t("feedback.error.body"));
    } finally {
      setBusy2fa(false);
    }
  };

  const confirmTwoFactor = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy2fa(true);

    try {
      const result = await authClient.twoFactor.verifyTotp({ code: setupCode.trim() });
      if (result.error) {
        toast.error(t("auth.twofa.invalid"));
        return;
      }

      // Codes are requested separately so they can be re-issued without
      // re-running the QR step; the server returns them exactly once.
      const codes = await authClient.twoFactor.generateBackupCodes({ password: "" });
      setBackupCodes(codes.data?.backupCodes ?? []);
      setTwoFactorEnabled(true);
      setSetupUri(null);
      setSetupQr(null);
      setSetupCode("");
      toast.success(t("settings.security.twofa_enabled"));
    } catch {
      toast.error(t("feedback.error.body"));
    } finally {
      setBusy2fa(false);
    }
  };

  const disableTwoFactor = async () => {
    setBusy2fa(true);
    try {
      const result = await authClient.twoFactor.disable({ password: disablePassword });
      if (result.error) {
        toast.error(t("auth.login.failed"));
        return;
      }
      setTwoFactorEnabled(false);
      setDisablePassword("");
      setBackupCodes([]);
      toast.success(t("settings.security.twofa_disabled"));
    } catch {
      toast.error(t("feedback.error.body"));
    } finally {
      setBusy2fa(false);
    }
  };

  const revokeSession = async (token: string) => {
    setRevokingId(token);
    try {
      // BetterAuth keys a session by its token, which is what `list-sessions`
      // returns — the internal id is never exposed to the client.
      await authClient.revokeSession({ token });
      setSessions((current) => current.filter((session) => session.token !== token));
      toast.success(t("settings.security.revoked"));
    } catch {
      toast.error(t("feedback.error.body"));
    } finally {
      setRevokingId(null);
    }
  };

  const revokeOthers = async () => {
    setRevokingId("*");
    try {
      await authClient.revokeOtherSessions();
      setSessions((current) => current.filter((session) => session.token === currentSessionToken));
      toast.success(t("settings.security.revoked"));
    } catch {
      toast.error(t("feedback.error.body"));
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[24px] font-semibold tracking-[-0.015em]">
          {t("settings.security.title")}
        </h1>
        <p className="text-[14px] text-muted-foreground">{t("settings.security.subtitle")}</p>
      </header>

      {/* --- Password --- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-muted-foreground" />
            {t("settings.security.password")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="flex max-w-md flex-col gap-4" noValidate>
            <FormField label={t("settings.security.current_password")} required>
              {(field) => (
                <Input
                  {...field}
                  type="password"
                  autoComplete="current-password"
                  required
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              )}
            </FormField>

            <FormField label={t("settings.security.new_password")} required>
              {(field) => (
                <div className="flex flex-col gap-2">
                  <Input
                    {...field}
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={10}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                  />
                  <PasswordStrength password={newPassword} />
                  <PasswordRequirements password={newPassword} />
                </div>
              )}
            </FormField>

            <Button
              type="submit"
              className="w-fit"
              disabled={changingPassword || !isPasswordAcceptable(newPassword) || currentPassword.length === 0}
            >
              {changingPassword ? <Spinner className="size-4" /> : null}
              {t("settings.security.change")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* --- Two-factor --- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-muted-foreground" />
            {t("settings.security.twofa")}
            <Badge variant={twoFactorEnabled ? "success" : "neutral"} className="ml-1">
              {twoFactorEnabled ? t("settings.security.twofa_on") : t("settings.security.twofa_off")}
            </Badge>
          </CardTitle>
          <CardDescription>{t("settings.security.twofa_backup_hint")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!twoFactorEnabled && !setupUri ? (
            <Button className="w-fit" onClick={() => void startTwoFactor()} disabled={busy2fa}>
              {busy2fa ? <Spinner className="size-4" /> : null}
              {t("settings.security.twofa_enable")}
            </Button>
          ) : null}

          {setupUri ? (
            <form onSubmit={confirmTwoFactor} className="flex max-w-md flex-col gap-4" noValidate>
              <div className="flex flex-col items-start gap-3 rounded-xl bg-surface-muted px-4 py-3">
                {setupQr ? (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL from qrcode; an <img> is the only way to render it without a canvas.
                  <img
                    src={setupQr}
                    alt={t("settings.security.twofa_scan")}
                    className="size-40 rounded-lg bg-white p-2"
                  />
                ) : null}
                <span className="break-all font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {setupUri}
                </span>
              </div>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {t("settings.security.twofa_scan")}
              </p>
              <FormField label={t("settings.security.twofa_code")} required>
                {(field) => (
                  <Input
                    {...field}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    className="w-40 text-center font-mono tracking-[0.3em]"
                    required
                    value={setupCode}
                    onChange={(event) => setSetupCode(event.target.value.replace(/\D/g, ""))}
                  />
                )}
              </FormField>
              <Button type="submit" className="w-fit" disabled={busy2fa || setupCode.length !== 6}>
                {busy2fa ? <Spinner className="size-4" /> : null}
                {t("settings.security.twofa_confirm")}
              </Button>
            </form>
          ) : null}

          {twoFactorEnabled ? (
            <div className="flex max-w-md flex-col gap-3">
              <FormField label={t("settings.security.current_password")} required>
                {(field) => (
                  <Input
                    {...field}
                    type="password"
                    autoComplete="current-password"
                    required
                    value={disablePassword}
                    onChange={(event) => setDisablePassword(event.target.value)}
                  />
                )}
              </FormField>
              <Button
                variant="destructive"
                className="w-fit"
                onClick={() => void disableTwoFactor()}
                disabled={busy2fa || disablePassword.length === 0}
              >
                {busy2fa ? <Spinner className="size-4" /> : null}
                {t("settings.security.twofa_disable")}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* --- Sessions --- */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>{t("settings.security.sessions")}</CardTitle>
            <CardDescription>{t("settings.security.sessions_hint")}</CardDescription>
          </div>
          {sessions.length > 1 ? (
            <Button variant="secondary" size="sm" onClick={() => void revokeOthers()} disabled={revokingId !== null}>
              {t("settings.security.revoke_others")}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y divide-border/60">
            {sessions.map((session) => (
              <li key={session.token} className="flex items-center gap-3 py-3">
                <Monitor className="size-4 shrink-0 text-muted-foreground" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13.5px] font-medium">
                    {session.userAgent ?? "—"}
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    {session.ipAddress ?? "—"} · {formatDateTime(session.createdAt)}
                  </span>
                </div>
                {session.token === currentSessionToken ? (
                  <Badge variant="success">{t("settings.security.current")}</Badge>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-error"
                    disabled={revokingId !== null}
                    onClick={() => void revokeSession(session.token)}
                  >
                    {revokingId === session.token ? <Spinner className="size-3.5" /> : null}
                    {t("settings.security.revoke")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* --- Backup codes, shown once --- */}
      {backupCodes.length > 0 ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={t("settings.security.twofa_backup")}
        >
          <Card className="w-full max-w-md p-6">
            <CardHeader className="p-0 pb-4">
              <CardTitle>{t("settings.security.twofa_backup")}</CardTitle>
              <CardDescription>{t("settings.security.twofa_backup_hint")}</CardDescription>
            </CardHeader>
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code) => (
                <span
                  key={code}
                  className="rounded-lg border border-border/70 bg-surface-muted px-3 py-2 text-center font-mono text-[13px] tracking-wider"
                >
                  {code}
                </span>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(backupCodes.join("\n"));
                  toast.success(t("common.copied"));
                }}
              >
                <Copy />
                {t("common.copy")}
              </Button>
              <Button size="sm" onClick={() => setBackupCodes([])}>
                <Check />
                {t("common.confirm")}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {googleEnabled ? (
        <p className="text-[12.5px] text-muted-foreground">{t("auth.login.with_google")}</p>
      ) : null}
    </div>
  );
}

export type { SessionInfo as SecuritySessionInfo };
