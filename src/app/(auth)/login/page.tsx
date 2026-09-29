import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { env } from "@/lib/env";
import { getServerDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Connexion" };

/** Error codes BetterAuth may append to the URL, mapped to our own messages. */
const REDIRECT_ERROR_KEYS: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "auth.login.failed",
  EMAIL_NOT_VERIFIED: "auth.login.unverified",
  BANNED_USER: "auth.login.banned",
  TOO_MANY_REQUESTS: "auth.login.too_many",
};

export default async function LoginPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t } = await getServerDictionary();
  const params = await searchParams;

  const rawError = typeof params.error === "string" ? params.error : undefined;
  const initialError = rawError ? REDIRECT_ERROR_KEYS[rawError] : undefined;

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
        googleEnabled={env.googleOAuthEnabled}
        {...(initialError ? { initialError } : {})}
      />
    </AuthCard>
  );
}
