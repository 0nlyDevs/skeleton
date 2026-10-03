import type { Metadata } from "next";
import { FuturisticAuth } from "@/components/auth/futuristic/futuristic-auth";
import { env } from "@/lib/env";
import { safeNextPath } from "@/lib/http/safe-redirect";
import { getServerDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Connexion" };

const REDIRECT_ERROR_KEYS: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "auth.login.failed",
  EMAIL_NOT_VERIFIED: "auth.login.unverified",
  BANNED_USER: "auth.login.banned",
  TOO_MANY_REQUESTS: "auth.login.too_many",
  access_denied: "auth.oauth.cancelled",
  account_not_linked: "auth.oauth.not_linked",
  unable_to_link_account: "auth.oauth.not_linked",
  email_not_verified: "auth.oauth.not_linked",
  email_not_found: "auth.oauth.no_email",
  state_not_found: "auth.oauth.expired",
  state_mismatch: "auth.oauth.expired",
  please_restart_the_process: "auth.oauth.expired",
};

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
    ? t((REDIRECT_ERROR_KEYS[rawError] ?? OAUTH_FALLBACK_KEY) as Parameters<typeof t>[0])
    : undefined;

  const redirectTo = safeNextPath(typeof params.next === "string" ? params.next : null);

  return (
    <FuturisticAuth
      initialView="login"
      redirectTo={redirectTo}
      {...(initialError ? { initialError } : {})}
      oauth={{ google: env.googleOAuthEnabled, github: env.githubOAuthEnabled }}
    />
  );
}
