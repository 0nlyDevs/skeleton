"use client";

import { AlertCircle, MailCheck } from "lucide-react";
import Link from "@/components/ui/link";
import { useState } from "react";

import { FormField } from "@/components/forms/form-field";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { requestPasswordReset } from "@/lib/auth/client";
import type { MessageKey } from "@/lib/i18n";

import { isNetworkFailure, resetRequestErrorMessageKey } from "./auth-errors";

/**
 * Password reset request.
 *
 * The confirmation is unconditional: whether or not an account exists for the
 * submitted address, the user sees the same sentence. The server behaves the
 * same way — BetterAuth even performs a dummy lookup to keep the timing flat — so
 * neither the response body nor the response time can be used to discover who is
 * registered.
 */
export function ForgotPasswordForm() {
  const t = useTranslation();

  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setErrorKey(null);

    try {
      const result = await requestPasswordReset({
        email: email.trim(),
        redirectTo: "/login",
      });

      if (result.error && resetRequestErrorMessageKey(result.error) !== "error.INTERNAL_ERROR") {
        setErrorKey(resetRequestErrorMessageKey(result.error));
        setPending(false);
        return;
      }

      // Even a hard server error must not tell the caller whether the address is
      // known, so the failure path shows the same confirmation.
      setSent(true);
    } catch (error) {
      if (isNetworkFailure(error)) {
        setErrorKey("auth.login.network");
        setPending(false);
        return;
      }
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <span className="flex size-11 items-center justify-center rounded-full bg-success/12 text-success">
          <MailCheck className="size-5" />
        </span>

        <p className="text-[14px] leading-relaxed text-muted-foreground">
          {t("auth.forgot.success")}
        </p>

        <Button asChild variant="secondary" size="lg">
          <Link href="/login">{t("common.back")}</Link>
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

      <FormField label={t("auth.login.email")} required>
        {(field) => (
          <Input
            {...field}
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            placeholder="nom@exemple.fr"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        )}
      </FormField>

      <Button type="submit" size="lg" disabled={pending || email.trim().length === 0}>
        {pending ? <Spinner className="size-4" /> : null}
        {pending ? t("common.loading") : t("auth.forgot.submit")}
      </Button>
    </form>
  );
}
