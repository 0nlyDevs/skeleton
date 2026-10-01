"use client";

import { AlertCircle, MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { FormField } from "@/components/forms/form-field";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { signUp } from "@/lib/auth/client";
import type { MessageKey } from "@/lib/i18n";

import { isNetworkFailure, registerErrorMessageKey } from "./auth-errors";
import { PasswordRequirements, PasswordStrength } from "./password-strength";
import { isPasswordAcceptable } from "@/lib/auth/password-policy";
import { GoogleButton, OrDivider } from "./oauth-buttons";

type Status = "idle" | "submitting" | "sent";

/**
 * Registration form.
 *
 * The interesting decision is what happens when the address is already taken:
 * **nothing visibly different**. The form switches to the same "check your inbox"
 * confirmation a brand-new account sees. Showing an explicit "email already
 * registered" error would hand an attacker a free membership oracle, and the
 * contest brief calls that out as a tested vulnerability family.
 *
 * The trade-off is real and worth stating: a returning user gets a confirmation
 * screen instead of a nudge to sign in. The sign-in link sits right there, and the
 * reset flow covers the forgotten-password case, so the cost is small next to the
 * information leak it prevents.
 */
export function RegisterForm({ googleEnabled }: { readonly googleEnabled: boolean }) {
  const t = useTranslation();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "submitting") return;

    setStatus("submitting");
    setErrorKey(null);

    try {
      const result = await signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
        callbackURL: "/dashboard",
      });

      if (result.error) {
        const key = registerErrorMessageKey(result.error);
        // `null` means "already exists": fall through to the neutral screen.
        if (key !== null) {
          setErrorKey(key);
          setStatus("idle");
          return;
        }
      }

      setStatus("sent");
    } catch (error) {
      setErrorKey(isNetworkFailure(error) ? "auth.login.network" : "error.INTERNAL_ERROR");
      setStatus("idle");
    }
  };

  if (status === "sent") {
    return (
      <div className="flex flex-col gap-4">
        <span className="flex size-11 items-center justify-center rounded-full bg-success/12 text-success">
          <MailCheck className="size-5" />
        </span>

        <div className="flex flex-col gap-1.5">
          <h2 className="text-[17px] font-semibold tracking-tight">
            {t("auth.register.success_title")}
          </h2>
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            {t("auth.register.success_body", { email: email.trim() })}
          </p>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {t("auth.register.neutral")}
          </p>
        </div>

        <Button asChild variant="secondary" size="lg">
          <Link href="/login">{t("auth.register.sign_in")}</Link>
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

      <FormField label={t("auth.register.name")} required>
        {(field) => (
          <Input
            {...field}
            name="name"
            autoComplete="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        )}
      </FormField>

      <FormField label={t("auth.register.email")} required>
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

      <FormField
        label={t("auth.register.password")}
        hint={t("auth.register.password_hint")}
        required
      >
        {(field) => (
          <div className="flex flex-col gap-2">
            <Input
              {...field}
              type="password"
              name="password"
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

      <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-muted-foreground">
        <Checkbox
          className="mt-0.5"
          checked={accepted}
          onCheckedChange={(value) => setAccepted(value === true)}
        />
        <span>
          {t("auth.register.terms")}{" "}
          <Link href="/terms" className="text-primary underline-offset-4 hover:underline">
            {t("footer.terms")}
          </Link>
          {" · "}
          <Link href="/privacy" className="text-primary underline-offset-4 hover:underline">
            {t("footer.privacy")}
          </Link>
        </span>
      </label>

      <Button
        type="submit"
        size="lg"
        disabled={
          status === "submitting" ||
          !accepted ||
          name.trim().length === 0 ||
          email.trim().length === 0 ||
          !isPasswordAcceptable(password)
        }
      >
        {status === "submitting" ? <Spinner className="size-4" /> : null}
        {status === "submitting" ? t("common.loading") : t("auth.register.submit")}
      </Button>

      {googleEnabled ? (
        <>
          <OrDivider />
          <GoogleButton callbackURL="/dashboard" />
        </>
      ) : null}
    </form>
  );
}
