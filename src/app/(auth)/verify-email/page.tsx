import type { Metadata } from "next";
import { redirect } from "next/navigation";

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
  if (token) {
    // Let BetterAuth consume the token in the document request. Verification
    // must not depend on this page hydrating its client component.
    const query = new URLSearchParams({ token, callbackURL: "/verify-email?verified=1" });
    redirect(`/api/auth/verify-email?${query.toString()}`);
  }

  const verified = params.verified === "1" && typeof params.error !== "string";
  const failed = typeof params.error === "string";

  return (
    <AuthCard title={t("auth.verify.title")}>
      <VerifyEmailPanel initialPhase={verified ? "verified" : failed ? "failed" : "idle"} />
    </AuthCard>
  );
}
