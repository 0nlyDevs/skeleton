import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { VerifyEmailPanel } from "@/components/auth/verify-email-panel";
import { getServerDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Vérification de l'e-mail" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t } = await getServerDictionary();
  const params = await searchParams;

  const token = typeof params.token === "string" ? params.token : undefined;

  return (
    <AuthCard title={t("auth.verify.title")}>
      <VerifyEmailPanel {...(token ? { token } : {})} />
    </AuthCard>
  );
}
