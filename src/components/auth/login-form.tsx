"use client";

import { AlertCircle, Eye, EyeOff, Fingerprint } from "lucide-react";
import Link from "@/components/ui/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { FormField } from "@/components/forms/form-field";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { signIn } from "@/lib/auth/client";
import type { MessageKey } from "@/lib/i18n";

import { isNetworkFailure, isRateLimited, loginErrorMessageKey } from "./auth-errors";
import { AttemptsLeft, LoginLockout, ProtectedSignInNote, SlowDown, useLoginProtection } from "./login-protection-notice";
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
  redirectTo = "/space",
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
  const protection = useLoginProtection();
  const { locked, paused, secondsLeft } = protection;

  const navigated = useRef(false);

  const finishSignIn = () => {
    if (navigated.current) return;
    navigated.current = true;
    router.replace(redirectTo);
    router.refresh();
  };

  /**
   * D02 — passwordless sign-in: the browser asks the device to unlock a
   * passkey with its face, fingerprint or PIN. Cancelling the device prompt is
   * not an error worth a red banner, so it only resets the button.
   */
  const signInWithPasskey = async () => {
    if (pending) return;
    if (typeof window === "undefined" || !window.PublicKeyCredential) {
      setErrorKey("auth.passkey.unsupported");
      return;
    }
    setPending(true);
    setErrorKey(null);
    try {
      const result = await signIn.passkey();
      if (result?.error) {
        const cancelled = /abort|cancel|not ?allowed/i.test(`${result.error.message ?? ""} ${"code" in result.error ? result.error.code : ""}`);
        if (!cancelled) setErrorKey(isRateLimited(result.error) ? "auth.login.too_many" : "auth.passkey.failed");
        setPending(false);
        return;
      }
      finishSignIn();
    } catch (error) {
      setErrorKey(isNetworkFailure(error) ? "auth.login.network" : "auth.passkey.failed");
      setPending(false);
    }
  };

  // Where the browser supports it, the identifier field also offers the
  // passkeys saved for this site (conditional mediation): picking one signs in
  // directly, with the device's face or fingerprint check.
  useEffect(() => {
    let active = true;
    const credential = typeof window !== "undefined" ? window.PublicKeyCredential : undefined;
    if (!credential?.isConditionalMediationAvailable) return;
    void credential.isConditionalMediationAvailable().then(async (available) => {
      if (!available || !active) return;
      const result = await signIn.passkey({ autoFill: true }).catch(() => null);
      if (active && result && !result.error) finishSignIn();
    });
    return () => {
      active = false;
    };
    // Runs once: the browser keeps the autofill request open on its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || paused) return;

    setPending(true);
    setErrorKey(null);

    try {
      // One field, two doors: an address goes to the email endpoint, anything
      // else is a username. Both are rate-limited and answer identically on a
      // wrong identifier or a wrong password.
      const identifier = email.trim();
      const { fetchOptions } = protection;
      const result = identifier.includes("@")
        ? await signIn.email({ email: identifier, password, rememberMe, callbackURL: redirectTo, fetchOptions })
        : await signIn.username({ username: identifier, password, rememberMe, callbackURL: redirectTo, fetchOptions });

      if (result.error) {
        setErrorKey(isRateLimited(result.error) ? null : loginErrorMessageKey(result.error));
        setPassword("");
        setPending(false);
        return;
      }

      // A successful sign-in with 2FA enabled never reaches this line: the
      // plugin navigates to the challenge page first.
      finishSignIn();
    } catch (error) {
      setErrorKey(isNetworkFailure(error) ? "auth.login.network" : "error.INTERNAL_ERROR");
      setPending(false);
    }
  };

  return (
    <form method="post" onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {locked ? <LoginLockout secondsLeft={secondsLeft} /> : null}
      {protection.slowDown ? <SlowDown secondsLeft={secondsLeft} /> : null}
      {errorKey && !paused ? (
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
      {!paused && protection.showAttemptsLeft ? <AttemptsLeft remaining={protection.attemptsLeft ?? 0} /> : null}

      <FormField label={t("auth.login.identifier")} required>
        {(field) => (
          <Input
            {...field}
            type="text"
            name="username"
            autoComplete="username webauthn"
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
        <label className="flex cursor-pointer items-center gap-2 text-[0.8125rem] text-muted-foreground">
          <Checkbox
            checked={rememberMe}
            onCheckedChange={(value) => setRememberMe(value === true)}
          />
          {t("auth.login.remember")}
        </label>

        <Link
          href="/forgot-password"
          className="text-[0.8125rem] font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("auth.login.forgot")}
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" disabled={pending || paused || email.length === 0 || password.length === 0}>
          {pending ? <Spinner className="size-4" /> : t("auth.login.submit")}
        </Button>
        <ProtectedSignInNote />
      </div>

      <div className="flex items-center gap-3 text-[0.75rem] uppercase tracking-wide text-muted-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        {t("auth.passkey.or")}
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Button type="button" variant="secondary" size="lg" disabled={pending} onClick={() => void signInWithPasskey()}>
          <Fingerprint aria-hidden />
          {t("auth.passkey.sign_in")}
        </Button>
        <p className="text-center text-[0.75rem] text-muted-foreground">{t("auth.passkey.sign_in_hint")}</p>
      </div>

      <OAuthButtons availability={oauth} callbackURL={redirectTo} />
    </form>
  );
}
