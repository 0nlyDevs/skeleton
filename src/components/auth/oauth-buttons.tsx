"use client";

import { useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth/client";

export type OAuthProvider = "google" | "github";

/** Which providers this deployment has credentials for; decided server-side. */
export interface OAuthAvailability {
  readonly google: boolean;
  readonly github: boolean;
}

export function hasAnyOAuth(availability: OAuthAvailability): boolean {
  return availability.google || availability.github;
}

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 18 18" className="size-[18px]">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.42 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-[18px] fill-current">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

const MARKS: Record<OAuthProvider, () => React.JSX.Element> = {
  google: GoogleMark,
  github: GitHubMark,
};

/**
 * One social sign-in button.
 *
 * Failures come back to `/login?error=<code>` (see `errorCallbackURL`), where
 * the code is translated, instead of BetterAuth's bare JSON error page.
 */
export function OAuthButton({
  provider,
  callbackURL = "/space",
}: {
  readonly provider: OAuthProvider;
  readonly callbackURL?: string;
}) {
  const t = useTranslation();
  const [pending, setPending] = useState(false);
  const Mark = MARKS[provider];

  const handleClick = async () => {
    setPending(true);
    try {
      const result = await authClient.signIn.social({
        provider,
        callbackURL,
        errorCallbackURL: "/login",
        newUserCallbackURL: "/settings/profile?welcome=1",
      });
      // An error result means the browser is not leaving the page.
      if (result.error) setPending(false);
    } catch {
      // The browser is about to leave the page; if it does not, the button must
      // become usable again rather than staying stuck in a spinner.
      setPending(false);
    }
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="lg"
      className="w-full"
      disabled={pending}
      onClick={() => void handleClick()}
    >
      {pending ? <Spinner className="size-4" /> : <Mark />}
      {provider === "google" ? t("auth.login.with_google") : t("auth.login.with_github")}
    </Button>
  );
}

/** Every configured provider, stacked; renders nothing when none is configured. */
export function OAuthButtons({
  availability,
  callbackURL,
}: {
  readonly availability: OAuthAvailability;
  readonly callbackURL?: string;
}) {
  if (!hasAnyOAuth(availability)) return null;

  return (
    <>
      <OrDivider />
      <div className="flex flex-col gap-2.5">
        {availability.google ? <OAuthButton provider="google" {...(callbackURL ? { callbackURL } : {})} /> : null}
        {availability.github ? <OAuthButton provider="github" {...(callbackURL ? { callbackURL } : {})} /> : null}
      </div>
    </>
  );
}

/** `or` rule between the OAuth buttons and the email form. */
export function OrDivider() {
  const t = useTranslation();

  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-border" aria-hidden />
      <span className="text-[0.7188rem] uppercase tracking-wide text-muted-foreground">
        {t("auth.login.or")}
      </span>
      <span className="h-px flex-1 bg-border" aria-hidden />
    </div>
  );
}
