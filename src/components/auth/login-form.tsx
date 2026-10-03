"use client";

import { AlertCircle, Eye, EyeOff } from "lucide-react";
import Link from "@/components/ui/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormField } from "@/components/forms/form-field";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { signIn } from "@/lib/auth/client";
import type { MessageKey } from "@/lib/i18n";

import { isNetworkFailure, loginErrorMessageKey } from "./auth-errors";
import { OAuthButtons, type OAuthAvailability } from "./oauth-buttons";

/**
 * Sign-in form.
 *
 * A few deliberate choices:
 *
 *  * **Errors are never per-field.** "No account with that address" would turn
 *    this form into an enumeration oracle, so a failure always reads
 *    "invalid email or password" no matter which half was wrong.
 *  * **The submit button never re-enables on success.** It stays in its pending
 *    state until the navigation actually happens, which prevents a double submit
 *    from a user who clicked twice out of impatience.
 *  * **A 2FA account is redirected by the auth client**, not by this component —
 *    the client plugin owns that hop so the password step cannot be considered
 *    "complete" by the UI.
 */
export function LoginForm({
  oauth,
  initialError,
  redirectTo = "/espace",
}: {
  readonly oauth: OAuthAvailability;
  readonly initialError?: string;
  /** Already validated by `safeNextPath` on the server. */
  readonly redirectTo?: string;
}) {
  const t = useTranslation();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [errorKey, setErrorKey] = useState<MessageKey | null>(
    (initialError as MessageKey | undefined) ?? null,
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setErrorKey(null);

    try {
      // One field, two doors: an address goes to the email endpoint, anything
      // else is a username. Both are rate-limited and answer identically on a
      // wrong identifier or a wrong password.
      const identifier = email.trim();
      const result = identifier.includes("@")
        ? await signIn.email({ email: identifier, password, rememberMe, callbackURL: redirectTo })
        : await signIn.username({ username: identifier, password, rememberMe, callbackURL: redirectTo });

      if (result.error) {
        setErrorKey(loginErrorMessageKey(result.error));
        setPending(false);
        return;
      }

      // A successful sign-in with 2FA enabled never reaches this line: the
      // plugin navigates to the challenge page first.
      router.replace(redirectTo);
      router.refresh();
    } catch (error) {
      setErrorKey(isNetworkFailure(error) ? "auth.login.network" : "error.INTERNAL_ERROR");
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {errorKey ? (
        <Alert variant="error">
          <AlertCircle />
          <AlertDescription className="text-foreground">
            {t(errorKey)}
            {errorKey === "auth.login.unverified" ? (
              <>
                {" "}
                <Link href="/verify-email" className="font-medium text-primary underline-offset-4 hover:underline">
                  {t("auth.verify.resend")}
                </Link>
              </>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <FormField label={t("auth.login.identifier")} required>
        {(field) => (
          <Input
            {...field}
            type="text"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="nom@exemple.fr"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        )}
      </FormField>

      <FormField label={t("auth.login.password")} required>
        {(field) => (
          <div className="relative">
            <Input
              {...field}
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        )}
      </FormField>

      <div className="flex items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
          <Checkbox
            checked={rememberMe}
            onCheckedChange={(value) => setRememberMe(value === true)}
          />
          {t("auth.login.remember")}
        </label>

        <Link
          href="/forgot-password"
          className="text-[13px] font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("auth.login.forgot")}
        </Link>
      </div>

      <Button type="submit" size="lg" disabled={pending || email.length === 0 || password.length === 0}>
        {pending ? <Spinner className="size-4" /> : null}
        {pending ? t("common.loading") : t("auth.login.submit")}
      </Button>

      <OAuthButtons availability={oauth} callbackURL={redirectTo} />
    </form>
  );
}
