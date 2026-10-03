"use client";

import { Fingerprint, KeyRound, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useFormatters } from "@/hooks/use-formatters";
import { authClient } from "@/lib/auth/client";

interface PasskeyRow {
  readonly id: string;
  readonly name?: string | null;
  readonly deviceType?: string | null;
  readonly backedUp?: boolean | null;
  readonly createdAt?: string | Date | null;
}

/** A readable default name for a new passkey: "iPhone", "Mac", "Windows"… */
function deviceName(): string {
  if (typeof navigator === "undefined") return "Appareil";
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Mac OS X/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Linux/i.test(ua)) return "Linux";
  return "Appareil";
}

/**
 * D02 — passkeys: sign in with this device's face, fingerprint or PIN, no
 * password. Each passkey is tied to one device (or synced by its password
 * manager); it can be renamed or removed. Adding or removing one alerts the
 * owner by email (see the auth hooks), so a stranger's passkey is noticed.
 */
export function PasskeysCard() {
  const t = useTranslation();
  const fmt = useFormatters();
  const [passkeys, setPasskeys] = useState<PasskeyRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState<PasskeyRow | null>(null);
  const [supported, setSupported] = useState(true);

  const load = useCallback(async () => {
    const { data } = await authClient.passkey.listUserPasskeys();
    setPasskeys((data as PasskeyRow[] | null) ?? []);
  }, []);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && Boolean(window.PublicKeyCredential));
    void load();
  }, [load]);

  const add = async () => {
    setBusy(true);
    try {
      const result = await authClient.passkey.addPasskey({ name: deviceName() });
      if (result?.error) {
        const cancelled = /abort|cancel|not ?allowed/i.test(`${result.error.message ?? ""} ${"code" in result.error ? result.error.code : ""}`);
        if (!cancelled) toast.error(t("auth.passkey.add_failed"));
        return;
      }
      toast.success(t("auth.passkey.added"));
      await load();
    } finally {
      setBusy(false);
    }
  };

  const rename = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return;
    setBusy(true);
    const { error } = await authClient.passkey.updatePasskey({ id: editing.id, name });
    setBusy(false);
    if (error) {
      toast.error(t("auth.passkey.update_failed"));
      return;
    }
    setEditing(null);
    await load();
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    const { error } = await authClient.passkey.deletePasskey({ id: removing.id });
    setBusy(false);
    if (error) {
      toast.error(t("auth.passkey.remove_failed"));
      return;
    }
    toast.success(t("auth.passkey.removed"));
    setRemoving(null);
    await load();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fingerprint className="size-4 text-muted-foreground" aria-hidden />
          {t("auth.passkey.title")}
          <Badge variant={passkeys && passkeys.length > 0 ? "success" : "neutral"} className="ml-1">
            {passkeys && passkeys.length > 0 ? t("auth.passkey.on", { count: passkeys.length }) : t("auth.passkey.off")}
          </Badge>
        </CardTitle>
        <CardDescription>{t("auth.passkey.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!supported ? <p className="text-sm text-warning">{t("auth.passkey.unsupported")}</p> : null}

        {passkeys === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t("common.loading")}
          </p>
        ) : passkeys.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border/70 rounded-xl border border-border/70">
            {passkeys.map((key) => (
              <li key={key.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <KeyRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                {editing?.id === key.id ? (
                  <form
                    className="flex flex-1 flex-wrap items-center gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void rename();
                    }}
                  >
                    <label htmlFor={`passkey-name-${key.id}`} className="sr-only">
                      {t("auth.passkey.name")}
                    </label>
                    <Input
                      id={`passkey-name-${key.id}`}
                      value={editing.name}
                      onChange={(event) => setEditing({ id: key.id, name: event.target.value })}
                      maxLength={60}
                      className="h-9 max-w-xs"
                      autoFocus
                    />
                    <Button type="submit" size="sm" disabled={busy}>
                      {t("common.save")}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      {t("common.cancel")}
                    </Button>
                  </form>
                ) : (
                  <>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{key.name || t("auth.passkey.unnamed")}</span>
                      <span className="text-[0.75rem] text-muted-foreground">
                        {key.createdAt ? t("auth.passkey.created", { date: fmt.date(new Date(key.createdAt).toISOString()) }) : null}
                        {key.backedUp ? ` · ${t("auth.passkey.synced")}` : ""}
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={t("auth.passkey.rename", { name: key.name || t("auth.passkey.unnamed") })}
                      onClick={() => setEditing({ id: key.id, name: key.name ?? "" })}
                    >
                      <Pencil aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={t("auth.passkey.remove", { name: key.name || t("auth.passkey.unnamed") })}
                      onClick={() => setRemoving(key)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("auth.passkey.empty")}</p>
        )}

        <Button type="button" className="w-fit" disabled={busy || !supported} onClick={() => void add()}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
          {t("auth.passkey.add")}
        </Button>
        <p className="text-[0.75rem] text-muted-foreground">{t("auth.passkey.privacy")}</p>
      </CardContent>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => (open ? null : setRemoving(null))}
        title={t("auth.passkey.remove_title", { name: removing?.name || t("auth.passkey.unnamed") })}
        description={t("auth.passkey.remove_body")}
        confirmLabel={t("auth.passkey.remove_confirm")}
        busy={busy}
        onConfirm={() => void remove()}
      />
    </Card>
  );
}
