"use client";

import { KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PasswordRequirements, PasswordStrength } from "@/components/auth/password-strength";
import { FormField } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiRequestError, apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { isPasswordAcceptable } from "@/lib/auth/password-policy";

type Field = "currentPassword" | "newPassword" | "confirmPassword";

/**
 * Change the password (or create a first one for an OAuth-only account).
 * Every failure names its field and its reason; nothing says just "invalid".
 */
export function PasswordCard({ hasPassword, onCreated }: { readonly hasPassword: boolean; readonly onCreated: () => void }) {
  const t = useTranslation();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  const localErrors = (): Partial<Record<Field, string>> => {
    const found: Partial<Record<Field, string>> = {};
    if (hasPassword && !current) found.currentPassword = t("password.required");
    if (!next) found.newPassword = t("password.required");
    else if (!isPasswordAcceptable(next)) found.newPassword = t("password.weak_detail");
    else if (hasPassword && next === current) found.newPassword = t("password.same");
    if (next && confirm !== next) found.confirmPassword = t("password.mismatch");
    return found;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = localErrors();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      if (hasPassword) {
        await apiFetch("/api/users/me/password", {
          method: "POST",
          body: { currentPassword: current, newPassword: next, confirmPassword: confirm },
        });
        toast.success(t("password.changed"));
      } else {
        await apiFetch("/api/users/me/password/initial", { method: "POST", body: { newPassword: next, confirmPassword: confirm } });
        toast.success(t("password.created"));
        onCreated();
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      setErrors({});
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields) {
        const mapped: Partial<Record<Field, string>> = {};
        if (error.fields.currentPassword) mapped.currentPassword = t("password.wrong_current");
        if (error.fields.newPassword) mapped.newPassword = error.fields.newPassword;
        if (error.fields.confirmPassword) mapped.confirmPassword = t("password.mismatch");
        setErrors(mapped);
      } else {
        toast.error(describeApiError(error, t));
      }
    } finally {
      setBusy(false);
    }
  };

  const field = (name: Field) => (errors[name] ? { error: errors[name] } : {});

  return (
    <Card id="password-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4 text-muted-foreground" />
          {hasPassword ? t("settings.security.password") : t("password.create_title")}
        </CardTitle>
        {!hasPassword ? <CardDescription>{t("password.create_hint")}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <form onSubmit={(event) => void submit(event)} className="flex max-w-md flex-col gap-4" noValidate>
          {hasPassword ? (
            <FormField label={t("password.current")} required {...field("currentPassword")}>
              {(props) => <PasswordInput {...props} autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} />}
            </FormField>
          ) : null}
          <FormField label={t("password.new")} required {...field("newPassword")}>
            {(props) => (
              <div className="flex flex-col gap-2">
                <PasswordInput {...props} autoComplete="new-password" value={next} onChange={(event) => setNext(event.target.value)} />
                <PasswordStrength password={next} />
                <PasswordRequirements password={next} />
              </div>
            )}
          </FormField>
          <FormField label={t("password.confirm")} required {...field("confirmPassword")}>
            {(props) => <PasswordInput {...props} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />}
          </FormField>
          <Button type="submit" className="w-fit" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            {hasPassword ? t("settings.security.change") : t("password.create_title")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

