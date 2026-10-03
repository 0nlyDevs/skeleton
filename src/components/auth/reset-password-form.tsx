"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "@/components/ui/link";
import { useState } from "react";

import { FormField } from "@/components/forms/form-field";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { resetPassword } from "@/lib/auth/client";
import type { MessageKey } from "@/lib/i18n";

import { isNetworkFailure, resetPasswordErrorMessageKey } from "./auth-errors";
import { PasswordRequirements, PasswordStrength } from "./password-strength";
import { isPasswordAcceptable } from "@/lib/auth/password-policy";

/**
 * Choose a new password.
 *
 * The token arrives in the URL, which is why the form posts it in the request
 * body rather than echoing it back into a hidden field or a link: it is read
 * once, used once, and never rendered again.
 *
 * Confirmation is a local client-side check only. The server never sees the
 * mistyped-by-accident value, and the password policy is still enforced
 * server-side regardless of what this form allows through.
 */
export function ResetPasswordForm({ token }: { readonly token: string }) {
  const t = useTranslation();

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);

  const mismatch = confirmation.length > 0 && confirmation !== password;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || mismatch) return;

    setPending(true);
    setErrorKey(null);

    try {
      const result = await resetPassword({ newPassword: password, token });

      if (result.error) {
        setErrorKey(resetPasswordErrorMessageKey(result.error));
        setPending(false);
        return;
      }

      setDone(true);
    } catch (error) {
      setErrorKey(isNetworkFailure(error) ? "auth.login.network" : "error.INTERNAL_ERROR");
      setPending(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <span className="flex size-11 items-center justify-center rounded-full bg-success/12 text-success">
          <CheckCircle2 className="size-5" />
        </span>
        <p className="text-[0.875rem] leading-relaxed text-muted-foreground">
          {t("auth.reset.success")}
        </p>
        <Button asChild size="lg">
          <Link href="/login">{t("auth.login.submit")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {errorKey ? (
        <Alert variant="error">
          <AlertCircle />
          <AlertDescription className="text-foreground">{t(errorKey)}</AlertDescription>
        </Alert>
      ) : null}

      <FormField label={t("auth.reset.new_password")} required>
        {(field) => (
          <div className="flex flex-col gap-2">
            <Input
              {...field}
              type="password"
              name="new-password"
              autoComplete="new-password"
              required
              minLength={10}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <PasswordStrength password={password} />
            <PasswordRequirements password={password} />
          </div>
        )}
      </FormField>

      <FormField
        label={t("auth.reset.confirm_password")}
        required
        {...(mismatch ? { error: t("auth.reset.mismatch") } : {})}
      >
        {(field) => (
          <Input
            {...field}
            type="password"
            name="confirm-password"
            autoComplete="new-password"
            required
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
        )}
      </FormField>

      <Button
        type="submit"
        size="lg"
        disabled={pending || !isPasswordAcceptable(password) || mismatch || confirmation.length === 0}
      >
        {pending ? <Spinner className="size-4" /> : null}
        {pending ? t("common.loading") : t("auth.reset.submit")}
      </Button>
    </form>
  );
}
