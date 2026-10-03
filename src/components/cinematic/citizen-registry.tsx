"use client";

import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Fingerprint, Landmark, X } from "lucide-react";
import gsap from "gsap";
import { useEffect, useId, useRef, useState } from "react";

import { isNetworkFailure, isRateLimited, loginErrorMessageKey } from "@/components/auth/auth-errors";
import { AttemptsLeft, LoginLockout, SlowDown, useLoginProtection } from "@/components/auth/login-protection-notice";
import { useTranslation } from "@/components/providers/i18n-provider";
import Link from "@/components/ui/link";
import { authClient, signIn, signUp } from "@/lib/auth/client";
import { checkPasswordRules, isPasswordAcceptable } from "@/lib/auth/password-policy";
import type { MessageKey } from "@/lib/i18n";
import { birthDateViolation, composeDisplayName, personNameViolation, usernameViolation } from "@/lib/validation/profile";

export type RegistryView = "signin" | "register";

const RULE_KEYS = {
  length: "auth.password.rule.length",
  lower: "auth.password.rule.lower",
  upper: "auth.password.rule.upper",
  digit: "auth.password.rule.digit",
  symbol: "auth.password.rule.symbol",
  repeat: "auth.password.rule.repeat",
  common: "auth.password.rule.common",
} as const satisfies Record<string, MessageKey>;

/** A citizen number that stays the same for the same name, so the card does not flicker while typing. */
function citizenNumber(seed: string): string {
  let hash = 7;
  for (const char of seed.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) % 9000;
  return `TN-214-${String(1000 + hash)}`;
}

function Field({
  label,
  error,
  children,
}: {
  readonly label: string;
  readonly error?: string | null;
  readonly children: (props: { id: string; "aria-invalid": boolean; "aria-describedby": string | undefined }) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="tn-label text-white/70">
        {label}
      </label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": error ? `${id}-error` : undefined })}
      {error ? (
        <p id={`${id}-error`} className="text-[0.75rem] text-red-200">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The citizens' registry: the one place where a resident signs in or asks for
 * an account, staged as the counter of Nova Prime's city hall. On one side the
 * citizen card being issued, filled in as the visitor types and stamped when
 * access is granted; on the other the form. Same accounts, same protection
 * against repeated attempts, same passkeys and providers as before.
 *
 * Sign-in errors are never per-field: a failure always reads "invalid e-mail
 * or password", so the form cannot be used to find out which accounts exist.
 */
export function CitizenRegistry({
  view,
  redirectTo,
  initialError,
  oauth,
  onView,
  onClose,
  onGranted,
  onCue,
}: {
  readonly view: RegistryView;
  /** Where a resident goes once recognised; already validated on the server. */
  readonly redirectTo: string;
  readonly initialError: MessageKey | null;
  readonly oauth: { readonly google: boolean; readonly github: boolean };
  readonly onView: (view: RegistryView) => void;
  readonly onClose: () => void;
  readonly onGranted: () => void;
  /** Plays a sound for what just happened. */
  readonly onCue: (cue: "error" | "success" | "stamp" | "click") => void;
}) {
  const t = useTranslation();
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const protection = useLoginProtection();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [errorKey, setErrorKey] = useState<MessageKey | null>(initialError);
  const [granted, setGranted] = useState<string | null>(null);

  const [step, setStep] = useState<1 | 2 | "done">(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, MessageKey>>({});
  const [refused, setRefused] = useState<string | null>(null);

  // The card and the counter come in from the sides; Escape goes back to the flight.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "power2.out" });
      gsap.fromTo("[data-registry='card']", { opacity: 0, x: -70, rotateY: -28 }, { opacity: 1, x: 0, rotateY: 0, duration: 1.2, delay: 0.5, ease: "power3.out" });
      gsap.fromTo("[data-registry='desk']", { opacity: 0, x: 70, scale: 0.94 }, { opacity: 1, x: 0, scale: 1, duration: 1.1, delay: 0.65, ease: "power3.out" });
    }, root);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      ctx.revert();
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // The card leans towards the pointer.
  const tilt = (event: React.PointerEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card || event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    card.style.setProperty("--ry", `${(((event.clientX - rect.left) / rect.width - 0.5) * 16).toFixed(2)}deg`);
    card.style.setProperty("--rx", `${((0.5 - (event.clientY - rect.top) / rect.height) * 12).toFixed(2)}deg`);
  };

  const recognise = (name: string | null) => {
    setGranted(name ?? "");
    onCue("stamp");
    window.setTimeout(() => onCue("success"), 260);
    window.setTimeout(onGranted, 1500);
  };

  const fail = (key: MessageKey | null) => {
    setErrorKey(key);
    setPending(false);
    onCue("error");
  };

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || protection.paused) return;
    setPending(true);
    setErrorKey(null);
    try {
      // One field, two doors: an address goes to the email endpoint, anything else is a username.
      // No `callbackURL`: the auth client would reload the page before the card is stamped.
      const id = identifier.trim();
      const { fetchOptions } = protection;
      const result = id.includes("@")
        ? await signIn.email({ email: id, password, rememberMe: true, fetchOptions })
        : await signIn.username({ username: id, password, rememberMe: true, fetchOptions });
      if (result.error) {
        setPassword("");
        // A pause is shown by the lockout panel instead of a red line.
        fail(isRateLimited(result.error) ? null : loginErrorMessageKey(result.error));
        return;
      }
      const data = result.data as { twoFactorRedirect?: boolean; user?: { name?: string } } | null;
      // An account with two-step sign-in is taken to its challenge page by the auth client.
      if (data?.twoFactorRedirect) return;
      recognise(data?.user?.name?.split(" ")[0] ?? null);
    } catch (error) {
      fail(isNetworkFailure(error) ? "auth.login.network" : "error.INTERNAL_ERROR");
    }
  };

  /** D02 — the device unlocks a passkey with a face, a fingerprint or a PIN. */
  const handlePasskey = async () => {
    if (pending) return;
    if (!window.PublicKeyCredential) return fail("auth.passkey.unsupported");
    setPending(true);
    setErrorKey(null);
    try {
      const result = await signIn.passkey();
      if (result?.error) {
        const cancelled = /abort|cancel|not ?allowed/i.test(`${result.error.message ?? ""} ${"code" in result.error ? result.error.code : ""}`);
        if (cancelled) setPending(false);
        else fail(isRateLimited(result.error) ? "auth.login.too_many" : "auth.passkey.failed");
        return;
      }
      recognise(null);
    } catch (error) {
      fail(isNetworkFailure(error) ? "auth.login.network" : "auth.passkey.failed");
    }
  };

  const handleProvider = async (provider: "google" | "github") => {
    try {
      const result = await authClient.signIn.social({ provider, callbackURL: redirectTo, errorCallbackURL: "/login", newUserCallbackURL: "/settings/profile?welcome=1" });
      if (result.error) fail("auth.oauth.failed");
    } catch {
      fail("auth.oauth.failed");
    }
  };

  const handleIdentity = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found: Record<string, MessageKey> = {};
    if (personNameViolation(firstName)) found.firstName = "tn.registry.error.first_name";
    if (personNameViolation(lastName)) found.lastName = "tn.registry.error.last_name";
    if (usernameViolation(username)) found.username = "tn.registry.error.username";
    if (birthDateViolation(birthDate)) found.birthDate = "tn.registry.error.birth_date";
    setErrors(found);
    if (Object.keys(found).length > 0) return onCue("error");
    onCue("click");
    setStep(2);
  };

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const address = email.trim();
    const found: Record<string, MessageKey> = {};
    if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(address)) found.email = "tn.registry.error.email";
    if (!isPasswordAcceptable(newPassword)) found.password = "tn.registry.error.password";
    if (newPassword !== confirm) found.confirm = "tn.registry.error.confirm";
    if (!terms) found.terms = "tn.registry.error.terms";
    setErrors(found);
    setRefused(null);
    if (Object.keys(found).length > 0) return onCue("error");
    setPending(true);
    try {
      const result = await signUp.email({
        name: composeDisplayName(firstName, lastName),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim(),
        birthDate,
        email: address,
        password: newPassword,
        callbackURL: redirectTo,
      } as Parameters<typeof signUp.email>[0]);
      setPending(false);
      if (result.error) {
        setRefused(result.error.message ?? t("tn.registry.error.refused"));
        onCue("error");
        return;
      }
      setStep("done");
      onCue("stamp");
    } catch {
      setPending(false);
      setRefused(t("auth.login.network"));
      onCue("error");
    }
  };

  const holder = view === "register" ? composeDisplayName(firstName, lastName).trim() : granted || identifier.trim();
  const handle = view === "register" ? username.trim() : identifier.trim();
  const sealed = granted !== null || step === "done";
  const rules = checkPasswordRules(newPassword);

  return (
    <div ref={rootRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="tn-registry dark text-white" onPointerMove={tilt}>
      <div className="fixed right-5 top-[18px] z-[2]">
        <button type="button" onClick={onClose} aria-label={t("tn.registry.close")} className="lg-btn lg-btn--round">
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="tn-registry-grid">
        {/* The card being issued. */}
        <div data-registry="card" className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <p className="tn-label flex items-center gap-2.5 text-[var(--tn-accent)]">
              <Landmark className="size-3.5" aria-hidden />
              {t("tn.registry.place")}
            </p>
            <h1 id={titleId} className="tn-display text-[clamp(1.9rem,4.4vw,3.3rem)] font-semibold leading-[1.02] [text-shadow:0_6px_40px_rgb(0_0_0/0.6)]">
              {t("tn.registry.title")}
            </h1>
            <p className="max-w-[44ch] text-[0.9375rem] leading-relaxed text-white/75 [text-shadow:0_1px_16px_rgb(0_0_0/0.8)]">{t("tn.registry.intro")}</p>
          </div>

          <div ref={cardRef} className="lg tn-idcard" aria-hidden>
            <span className="tn-idcard-holo" />
            <div className="flex h-full flex-col justify-between">
              <div className="flex items-start justify-between gap-4">
                <p className="tn-display text-[0.6875rem] font-semibold tracking-[0.22em]">TERRA NOVA</p>
                <p className="tn-label text-white/70">{t("tn.registry.card.title")}</p>
              </div>
              <div className="flex items-end gap-4">
                <span className="lg-orb tn-display size-14 text-[1.125rem] font-semibold text-white">{(holder[0] ?? "?").toUpperCase()}</span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="tn-label text-white/55">{t("tn.registry.card.holder")}</span>
                  <span className="tn-display truncate text-[1.0625rem] font-medium">{holder || t("tn.registry.card.holder_empty")}</span>
                  {handle ? <span className="tn-figure truncate text-[0.6875rem] text-white/60">@{handle.replace(/@.*/, "")}</span> : null}
                </div>
              </div>
              <div className="flex items-end justify-between gap-4">
                <dl className="grid grid-cols-[auto_auto] gap-x-5 gap-y-1">
                  <dt className="tn-label text-white/50">{t("tn.registry.card.number")}</dt>
                  <dd className="tn-figure text-[0.6875rem]">{citizenNumber(handle || "terra")}</dd>
                  <dt className="tn-label text-white/50">{t("tn.registry.card.district")}</dt>
                  <dd className="tn-figure text-[0.6875rem]">Nova Prime</dd>
                  <dt className="tn-label text-white/50">{t("tn.registry.card.issued")}</dt>
                  <dd className="tn-figure text-[0.6875rem]">214</dd>
                </dl>
                <span className="tn-idcard-code w-24" />
              </div>
            </div>
            <span className="tn-seal" data-on={sealed ? "" : undefined}>
              {t("tn.registry.card.seal")}
            </span>
          </div>
        </div>

        {/* The counter. */}
        <div data-registry="desk" className="lg p-6 sm:p-8">
          {granted !== null ? (
            <div role="status" className="flex flex-col items-start gap-4 py-6">
              <span className="lg-orb size-14">
                <Check className="size-6" aria-hidden />
              </span>
              <p className="tn-label text-[var(--tn-accent)]">{t("tn.registry.granted")}</p>
              <p className="tn-display text-[1.375rem] font-medium leading-snug">{t("tn.registry.granted_body", { name: granted || t("tn.registry.card.seal") })}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div role="tablist" className="tn-seg" data-view={view}>
                <button type="button" role="tab" aria-selected={view === "signin"} onClick={() => onView("signin")}>
                  {t("tn.registry.tab_signin")}
                </button>
                <button type="button" role="tab" aria-selected={view === "register"} onClick={() => onView("register")}>
                  {t("tn.registry.tab_register")}
                </button>
              </div>

              {view === "signin" ? (
                <form onSubmit={handleSignIn} className="flex flex-col gap-4" noValidate>
                  {protection.locked ? <LoginLockout secondsLeft={protection.secondsLeft} /> : null}
                  {protection.slowDown ? <SlowDown secondsLeft={protection.secondsLeft} /> : null}
                  {errorKey && !protection.paused ? (
                    <p role="alert" className="rounded-2xl bg-red-500/15 px-4 py-3 text-[0.8438rem] text-red-100 shadow-[inset_0_0_0_1px_rgb(248_113_113/0.45)]">
                      {t(errorKey)}
                    </p>
                  ) : null}
                  {!protection.paused && protection.showAttemptsLeft ? <AttemptsLeft remaining={protection.attemptsLeft ?? 0} /> : null}

                  <Field label={t("auth.login.identifier")}>
                    {(field) => (
                      <input {...field} className="tn-input" type="text" name="username" autoComplete="username webauthn" autoCapitalize="none" spellCheck={false} required value={identifier} onChange={(event) => setIdentifier(event.target.value)} />
                    )}
                  </Field>
                  <Field label={t("auth.login.password")}>
                    {(field) => (
                      <span className="relative">
                        <input {...field} className="tn-input pr-12" type={showPassword ? "text" : "password"} name="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
                        <button
                          type="button"
                          onClick={() => setShowPassword((current) => !current)}
                          aria-label={showPassword ? t("tn.registry.hide_password") : t("tn.registry.show_password")}
                          className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-white/60 hover:text-white"
                        >
                          {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                        </button>
                      </span>
                    )}
                  </Field>

                  <button type="submit" disabled={pending || protection.paused || identifier.length === 0 || password.length === 0} className="lg-btn lg-btn--amber mt-1 w-full py-3.5">
                    {pending ? t("tn.registry.checking") : t("tn.registry.signin_submit")}
                    {pending ? null : <ArrowRight className="size-4" aria-hidden />}
                  </button>

                  <div className="flex flex-col gap-2">
                    <button type="button" disabled={pending} onClick={() => void handlePasskey()} className="lg-btn w-full">
                      <Fingerprint className="size-4" aria-hidden />
                      {t("auth.passkey.sign_in")}
                    </button>
                    {oauth.google || oauth.github ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {oauth.google ? (
                          <button type="button" disabled={pending} onClick={() => void handleProvider("google")} className="lg-btn">
                            {t("auth.login.with_google")}
                          </button>
                        ) : null}
                        {oauth.github ? (
                          <button type="button" disabled={pending} onClick={() => void handleProvider("github")} className="lg-btn">
                            {t("auth.login.with_github")}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <Link href="/forgot-password" className="self-start text-[0.8125rem] text-white/70 underline-offset-4 hover:text-white hover:underline">
                    {t("auth.login.forgot")}
                  </Link>
                </form>
              ) : step === "done" ? (
                <div role="status" className="flex flex-col items-start gap-4 py-4">
                  <span className="lg-orb size-14">
                    <Check className="size-6" aria-hidden />
                  </span>
                  <p className="tn-display text-[1.375rem] font-medium leading-snug">{t("auth.register.success_title")}</p>
                  <p className="text-[0.9062rem] leading-relaxed text-white/75">{t("auth.register.success_body")}</p>
                  <button type="button" onClick={() => onView("signin")} className="lg-btn mt-1">
                    {t("tn.registry.tab_signin")}
                    <ArrowRight className="size-4" aria-hidden />
                  </button>
                </div>
              ) : step === 1 ? (
                <form onSubmit={handleIdentity} className="flex flex-col gap-4" noValidate>
                  <p className="tn-label text-white/55">{t("tn.registry.step", { step: 1 })}</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t("profile.first_name")} error={errors.firstName ? t(errors.firstName) : null}>
                      {(field) => <input {...field} className="tn-input" type="text" autoComplete="given-name" required value={firstName} onChange={(event) => setFirstName(event.target.value)} />}
                    </Field>
                    <Field label={t("profile.last_name")} error={errors.lastName ? t(errors.lastName) : null}>
                      {(field) => <input {...field} className="tn-input" type="text" autoComplete="family-name" required value={lastName} onChange={(event) => setLastName(event.target.value)} />}
                    </Field>
                  </div>
                  <Field label={t("profile.username")} error={errors.username ? t(errors.username) : null}>
                    {(field) => <input {...field} className="tn-input" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={username} onChange={(event) => setUsername(event.target.value)} />}
                  </Field>
                  <Field label={t("tn.registry.birth_date")} error={errors.birthDate ? t(errors.birthDate) : null}>
                    {(field) => <input {...field} className="tn-input" type="date" autoComplete="bday" required value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />}
                  </Field>
                  <button type="submit" className="lg-btn lg-btn--amber mt-1 w-full py-3.5">
                    {t("tn.registry.next")}
                    <ArrowRight className="size-4" aria-hidden />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="flex flex-col gap-4" noValidate>
                  <p className="tn-label text-white/55">{t("tn.registry.step", { step: 2 })}</p>
                  {refused ? (
                    <p role="alert" className="rounded-2xl bg-red-500/15 px-4 py-3 text-[0.8438rem] text-red-100 shadow-[inset_0_0_0_1px_rgb(248_113_113/0.45)]">
                      {refused}
                    </p>
                  ) : null}
                  <Field label={t("auth.register.email")} error={errors.email ? t(errors.email) : null}>
                    {(field) => <input {...field} className="tn-input" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />}
                  </Field>
                  <Field label={t("auth.register.password")} error={errors.password ? t(errors.password) : null}>
                    {(field) => <input {...field} className="tn-input" type={showPassword ? "text" : "password"} autoComplete="new-password" required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />}
                  </Field>
                  {newPassword.length > 0 ? (
                    <ul className="grid gap-x-4 gap-y-1 text-[0.75rem] sm:grid-cols-2">
                      {rules.map((rule) => (
                        <li key={rule.id} className={`flex items-center gap-2 ${rule.ok ? "text-emerald-300" : "text-white/60"}`}>
                          <span aria-hidden className={`size-1.5 rounded-full ${rule.ok ? "bg-emerald-300" : "bg-white/35"}`} />
                          {t(RULE_KEYS[rule.id])}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <Field label={t("tn.registry.confirm")} error={errors.confirm ? t(errors.confirm) : null}>
                    {(field) => <input {...field} className="tn-input" type={showPassword ? "text" : "password"} autoComplete="new-password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} />}
                  </Field>
                  <label className="flex cursor-pointer items-start gap-3 text-[0.8125rem] leading-snug text-white/75">
                    <input type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--tn-accent)]" />
                    <span>
                      {t("auth.register.terms")}
                      {errors.terms ? <span className="mt-1 block text-red-200">{t(errors.terms)}</span> : null}
                    </span>
                  </label>
                  <div className="mt-1 flex gap-2">
                    <button type="button" onClick={() => setStep(1)} aria-label={t("tn.registry.back")} className="lg-btn lg-btn--round shrink-0">
                      <ArrowLeft className="size-4" aria-hidden />
                    </button>
                    <button type="submit" disabled={pending} className="lg-btn lg-btn--amber flex-1 py-3.5">
                      {pending ? t("tn.registry.checking") : t("tn.registry.register_submit")}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
