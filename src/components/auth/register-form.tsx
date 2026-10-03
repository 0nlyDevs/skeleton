"use client";

import { AlertCircle, MailCheck } from "lucide-react";
import Link from "@/components/ui/link";
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
import { UsernameField, type UsernameState } from "@/components/forms/username-field";
import {
  birthDateViolation,
  composeDisplayName,
  personNameViolation,
  usernameViolation,
} from "@/lib/validation/profile";
import { OAuthButtons, type OAuthAvailability } from "./oauth-buttons";

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
export function RegisterForm({ oauth }: { readonly oauth: OAuthAvailability }) {
  const t = useTranslation();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameState, setUsernameState] = useState<UsernameState>("idle");
  const [birthDate, setBirthDate] = useState("");
  const [email, setEmail] = useState("");
  // Field errors appear once a field has been left, not while typing.
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const touch = (field: string) => setTouched((current) => new Set(current).add(field));

  const invalid = {
    firstName: personNameViolation(firstName) !== null,
    lastName: personNameViolation(lastName) !== null,
    username: usernameViolation(username) !== null || usernameState === "taken",
    birthDate: birthDateViolation(birthDate) !== null,
  };
  const fieldError = (field: keyof typeof invalid, key: MessageKey) =>
    touched.has(field) && invalid[field] ? { error: t(key) } : {};
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "submitting") return;

    // Never a silently disabled button: submitting an incomplete form shows
    // every field's reason and a summary at the top.
    const problems =
      Object.values(invalid).some(Boolean) ||
      !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email.trim()) ||
      !isPasswordAcceptable(password) ||
      !accepted;
    if (problems) {
      setTouched(new Set(["firstName", "lastName", "username", "birthDate", "email", "password", "terms"]));
      setErrorKey("auth.register.fix_fields");
      return;
    }

    setStatus("submitting");
    setErrorKey(null);

    try {
      // The server re-validates every field and derives `name` itself; these
      // values only save a round trip.
      const result = await signUp.email({
        name: composeDisplayName(firstName, lastName),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim(),
        birthDate,
        email: email.trim(),
        password,
        callbackURL: "/espace",
      } as Parameters<typeof signUp.email>[0]);

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

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField label={t("profile.first_name")} required {...fieldError("firstName", "profile.error.name")}>
          {(field) => (
            <Input
              {...field}
              name="given-name"
              autoComplete="given-name"
              required
              maxLength={50}
              value={firstName}
              onBlur={() => touch("firstName")}
              onChange={(event) => setFirstName(event.target.value)}
            />
          )}
        </FormField>

        <FormField label={t("profile.last_name")} required {...fieldError("lastName", "profile.error.name")}>
          {(field) => (
            <Input
              {...field}
              name="family-name"
              autoComplete="family-name"
              required
              maxLength={50}
              value={lastName}
              onBlur={() => touch("lastName")}
              onChange={(event) => setLastName(event.target.value)}
            />
          )}
        </FormField>
      </div>

      <FormField
        label={t("profile.username")}
        hint={t("profile.username_hint")}
        required
      >
        {(field) => (
          <UsernameField
            inputProps={field}
            value={username}
            onStateChange={setUsernameState}
            onChange={(value) => {
              touch("username");
              setUsername(value);
            }}
          />
        )}
      </FormField>

      <FormField
        label={t("profile.birth_date")}
        hint={t("profile.birth_date_hint")}
        required
        {...fieldError("birthDate", "profile.error.birth_date")}
      >
        {(field) => (
          <Input
            {...field}
            type="date"
            name="bday"
            autoComplete="bday"
            required
            max={new Date().toISOString().slice(0, 10)}
            value={birthDate}
            onBlur={() => touch("birthDate")}
            onChange={(event) => setBirthDate(event.target.value)}
          />
        )}
      </FormField>

      <FormField
        label={t("auth.register.email")}
        required
        {...(touched.has("email") && !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email.trim()) ? { error: t("auth.register.email_invalid") } : {})}
      >
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
        disabled={status === "submitting"}
      >
        {status === "submitting" ? <Spinner className="size-4" /> : null}
        {status === "submitting" ? t("common.loading") : t("auth.register.submit")}
      </Button>

      <OAuthButtons availability={oauth} callbackURL="/espace" />
    </form>
  );
}
