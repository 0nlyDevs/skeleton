import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { TwoFactorForm } from "@/components/auth/two-factor-form";
import { getServerDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Vérification en deux étapes" };

/**
 * The 2FA challenge.
 *
 * Reached after a correct password when the account has TOTP enabled: the auth
 * client plugin navigates here instead of completing the sign-in, so the session
 * is not issued until the second factor is verified.
 *
 * Note the page is public at the middleware level — reaching it proves the
 * password was accepted but says nothing about the session, and locking it behind
 * the middleware would make the challenge unreachable by definition.
 */
export default async function TwoFactorPage() {
  const { t } = await getServerDictionary();

  return (
    <AuthCard title={t("auth.twofa.title")} subtitle={t("auth.twofa.subtitle")}>
      <TwoFactorForm />
    </AuthCard>
  );
}
