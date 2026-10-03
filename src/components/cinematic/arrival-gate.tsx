"use client";

import { ArrowRight, Check, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { isNetworkFailure, isRateLimited, loginErrorMessageKey } from "@/components/auth/auth-errors";
import { DisplayMenu } from "@/components/layout/display-menu";
import { LocaleToggle } from "@/components/layout/locale-toggle";
import { useTranslation } from "@/components/providers/i18n-provider";
import Link from "@/components/ui/link";
import { signIn } from "@/lib/auth/client";
import type { MessageKey } from "@/lib/i18n";

export interface ArrivalPass {
  /** First name of the resident who signed in, when there is one. */
  readonly name: string | null;
  readonly visitor: boolean;
}

function Corner({ className }: { readonly className: string }) {
  return <span aria-hidden className={`pointer-events-none absolute size-7 border-white/35 ${className}`} />;
}

/**
 * Arrival control: the screen a visitor meets in orbit, before the descent.
 * A resident signs in here (same accounts and same protection as `/login`);
 * anyone else enters as a visitor. `pass` is set once the way down is open.
 *
 * Errors are never per-field: a failure always reads "invalid e-mail or
 * password", so this form cannot be used to find out which accounts exist.
 */
export function ArrivalGate({
  pass,
  onGranted,
  onVisitor,
  onSkip,
}: {
  readonly pass: ArrivalPass | null;
  readonly onGranted: (name: string | null) => void;
  readonly onVisitor: () => void;
  /** Ends the descent at once; offered while it plays. */
  readonly onSkip: () => void;
}) {
  const t = useTranslation();
  const router = useRouter();
  const titleId = useId();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setErrorKey(null);
    try {
      // One field, two doors: an address goes to the email endpoint, anything else is a username.
      // No `callbackURL`: the auth client would reload the page, and the descent plays on this one.
      const id = identifier.trim();
      const result = id.includes("@")
        ? await signIn.email({ email: id, password, rememberMe: true })
        : await signIn.username({ username: id, password, rememberMe: true });
      if (result.error) {
        setErrorKey(isRateLimited(result.error) ? "auth.login.too_many" : loginErrorMessageKey(result.error));
        setPassword("");
        setPending(false);
        return;
      }
      const data = result.data as { twoFactorRedirect?: boolean; user?: { name?: string } } | null;
      // An account with two-step sign-in is taken to its challenge page by the auth client.
      if (data?.twoFactorRedirect) return;
      onGranted(data?.user?.name?.split(" ")[0] ?? null);
      router.refresh();
    } catch (error) {
      setErrorKey(isNetworkFailure(error) ? "auth.login.network" : "error.INTERNAL_ERROR");
      setPending(false);
    }
  };

  return (
    <section data-gate="root" aria-labelledby={titleId} className="fixed inset-0 z-30 text-white">
      <Corner className="left-4 top-4 border-l border-t sm:left-6 sm:top-6" />
      <Corner className="right-4 top-4 border-r border-t sm:right-6 sm:top-6" />
      <Corner className="bottom-4 left-4 border-b border-l sm:bottom-6 sm:left-6" />
      <Corner className="bottom-4 right-4 border-b border-r sm:bottom-6 sm:right-6" />

      <header className="absolute inset-x-0 top-0 flex items-center justify-between gap-4 px-8 pt-7 sm:px-12 sm:pt-10">
        <p className="flex flex-col gap-1">
          <span className="font-display text-[1.1875rem] font-bold tracking-wide">TERRA NOVA</span>
          <span className="hidden text-[0.625rem] uppercase tracking-[0.32em] text-white/60 sm:block">{t("tn.arrival.station")}</span>
        </p>
        <div className="flex items-center gap-1.5">
          <LocaleToggle className="text-white/75 hover:bg-white/10 hover:text-white" />
          <DisplayMenu className="text-white/75 hover:bg-white/10 hover:text-white" />
        </div>
      </header>

      {/* The island's beacon on the planet; the stage moves this label every frame. */}
      <p data-gate="beacon" aria-hidden className="tn-tag hidden sm:block">
        {t("tn.arrival.beacon")}
      </p>

      <div data-gate="panel" className="absolute inset-x-4 bottom-[9svh] mx-auto max-w-[440px] sm:inset-x-auto sm:bottom-auto sm:left-[max(3rem,7vw)] sm:top-1/2 sm:mx-0 sm:w-[420px] sm:-translate-y-1/2">
        <div className="tn-panel p-6 sm:p-8">
          {pass ? (
            <div role="status" className="flex flex-col gap-4">
              <span className="grid size-12 place-items-center rounded-full bg-[var(--brand-400)]/15 text-[var(--brand-400)] ring-1 ring-[var(--brand-400)]/50">
                <Check className="size-5" aria-hidden />
              </span>
              <p className="text-[0.6875rem] font-medium uppercase tracking-[0.32em] text-[var(--brand-400)]">
                {pass.visitor ? t("tn.arrival.granted_visitor") : t("tn.arrival.granted")}
              </p>
              <h1 id={titleId} className="text-[1.75rem] font-semibold leading-tight tracking-tight">
                {pass.name ? t("tn.arrival.welcome_back", { name: pass.name }) : t("tn.arrival.descending")}
              </h1>
              <p className="text-[0.9062rem] leading-relaxed text-white/65">{t("tn.arrival.welcome_body")}</p>
              <button type="button" onClick={onSkip} className="tn-cta-ghost mt-1 inline-flex w-fit items-center gap-2 rounded-full px-5 py-2.5 text-[0.8438rem]">
                {t("tn.arrival.land_now")}
                <ArrowRight className="size-4" aria-hidden />
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              <p className="flex items-center gap-2.5 text-[0.6875rem] font-medium uppercase tracking-[0.28em] text-[var(--brand-400)]">
                <span aria-hidden className="tn-blink size-1.5 rounded-full bg-[var(--brand-400)]" />
                {t("tn.arrival.station")}
              </p>
              <h1 id={titleId} className="text-[1.75rem] font-semibold leading-[1.1] tracking-tight">
                {t("tn.arrival.title")}
              </h1>
              <p className="text-[0.875rem] leading-relaxed text-white/65">{t("tn.arrival.body")}</p>

              {errorKey ? (
                <p role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 px-3.5 py-2.5 text-[0.8438rem] text-red-100">
                  {t(errorKey)}
                </p>
              ) : null}

              <label className="flex flex-col gap-1.5 text-[0.8125rem] text-white/75">
                {t("auth.login.identifier")}
                <input
                  className="tn-field"
                  type="text"
                  name="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[0.8125rem] text-white/75">
                {t("auth.login.password")}
                <span className="relative">
                  <input
                    className="tn-field pr-11"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? t("tn.arrival.hide_password") : t("tn.arrival.show_password")}
                    className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-white/55 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                  </button>
                </span>
              </label>

              <button
                type="submit"
                disabled={pending || identifier.length === 0 || password.length === 0}
                className="tn-cta-brand mt-1 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[0.9375rem] font-semibold"
              >
                {pending ? t("tn.arrival.checking") : t("tn.arrival.submit")}
                {pending ? null : <ArrowRight className="size-4" aria-hidden />}
              </button>
              <button type="button" onClick={onVisitor} disabled={pending} className="tn-cta-ghost rounded-full px-6 py-3 text-[0.9062rem]">
                {t("tn.arrival.visitor")}
              </button>

              <p className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-1 text-[0.7812rem] text-white/60">
                <Link href="/register" className="font-medium text-white underline-offset-4 hover:underline">
                  {t("auth.login.create")}
                </Link>
                <Link href="/forgot-password" className="underline-offset-4 hover:text-white hover:underline">
                  {t("auth.login.forgot")}
                </Link>
                <Link href="/login" className="underline-offset-4 hover:text-white hover:underline">
                  {t("tn.arrival.other")}
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>

      {/* Flight instruments: decoration only, the numbers follow the 3D approach. */}
      <div aria-hidden className="pointer-events-none absolute bottom-9 right-9 hidden items-end gap-8 sm:bottom-12 sm:right-14 md:flex">
        <svg viewBox="0 0 120 120" className="size-[108px] text-white/45">
          <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="0.6" />
          <circle cx="60" cy="60" r="36" fill="none" stroke="currentColor" strokeWidth="0.4" strokeDasharray="2 4" />
          <circle cx="60" cy="60" r="16" fill="none" stroke="currentColor" strokeWidth="0.4" />
          <path d="M4 60h112M60 4v112" stroke="currentColor" strokeWidth="0.3" />
          <g className="tn-sweep">
            <path d="M60 60 L60 4 A56 56 0 0 1 99.6 20.4 Z" fill="url(#tn-sweep-fill)" />
          </g>
          <circle cx="78" cy="42" r="2.2" className="tn-blink" fill="var(--brand-400)" />
          <defs>
            <linearGradient id="tn-sweep-fill" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="var(--brand-400)" stopOpacity="0" />
              <stop offset="1" stopColor="var(--brand-400)" stopOpacity="0.4" />
            </linearGradient>
          </defs>
        </svg>
        <dl className="grid grid-cols-[auto_auto] gap-x-5 gap-y-1.5 text-[0.6875rem] uppercase tracking-[0.2em] text-white/55">
          <dt>{t("tn.arrival.hud.altitude")}</dt>
          <dd className="text-right font-mono tabular-nums text-white">
            <span data-gate="altitude">412</span> km
          </dd>
          <dt>{t("tn.arrival.hud.speed")}</dt>
          <dd className="text-right font-mono tabular-nums text-white">
            <span data-gate="speed">7.61</span> km/s
          </dd>
          <dt>{t("tn.arrival.hud.pad")}</dt>
          <dd className="text-right font-mono text-white">SKY-03</dd>
          <dt>{t("tn.arrival.hud.sol")}</dt>
          <dd className="text-right font-mono tabular-nums text-white">214</dd>
        </dl>
      </div>
      <p aria-hidden data-gate="status" className="pointer-events-none absolute bottom-10 left-9 hidden items-center gap-2.5 text-[0.625rem] uppercase tracking-[0.3em] text-white/55 sm:bottom-[3.25rem] sm:left-14 lg:flex">
        <span className="tn-blink size-1.5 rounded-full bg-[var(--brand-400)]" />
        {pass ? t("tn.arrival.entry") : t("tn.arrival.status")}
      </p>
    </section>
  );
}
