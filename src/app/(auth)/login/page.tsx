import type { Metadata } from "next";
import Link from "@/components/ui/link";

import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { env } from "@/lib/env";
import { safeNextPath } from "@/lib/http/safe-redirect";
import { getServerDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Connexion" };

/** Error codes BetterAuth may append to the URL, mapped to our own messages. */
const REDIRECT_ERROR_KEYS: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "auth.login.failed",
  EMAIL_NOT_VERIFIED: "auth.login.unverified",
  BANNED_USER: "auth.login.banned",
  TOO_MANY_REQUESTS: "auth.login.too_many",
  // OAuth callback failures (BetterAuth `onAPIError.errorURL`).
  access_denied: "auth.oauth.cancelled",
  account_not_linked: "auth.oauth.not_linked",
  unable_to_link_account: "auth.oauth.not_linked",
  email_not_verified: "auth.oauth.not_linked",
  email_not_found: "auth.oauth.no_email",
  state_not_found: "auth.oauth.expired",
  state_mismatch: "auth.oauth.expired",
  please_restart_the_process: "auth.oauth.expired",
};

/** Any other provider error still gets a translated, non-technical message. */
const OAUTH_FALLBACK_KEY = "auth.oauth.failed";

export default async function LoginPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t } = await getServerDictionary();
  const params = await searchParams;

  const rawError = typeof params.error === "string" ? params.error : undefined;
  const initialError = rawError
    ? (REDIRECT_ERROR_KEYS[rawError] ?? OAUTH_FALLBACK_KEY)
    : undefined;

  return (
    <AuthCard
      title={t("auth.login.title")}
      subtitle={t("auth.login.subtitle")}
      footer={
        <>
          {t("auth.login.no_account")}{" "}
          <Link
            href="/register"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {t("auth.login.create")}
          </Link>
        </>
      }
    >
      <LoginForm
        oauth={{ google: env.googleOAuthEnabled, github: env.githubOAuthEnabled }}
        redirectTo={safeNextPath(typeof params.next === "string" ? params.next : null)}
        {...(initialError ? { initialError } : {})}
      />
    </AuthCard>
  );
}
