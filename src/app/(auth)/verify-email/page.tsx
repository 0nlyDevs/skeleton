import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { FuturisticAuth } from "@/components/auth/futuristic/futuristic-auth";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Vérification de l'e-mail" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : undefined;

  if (token) {
    // Use BetterAuth's own GET handler as the document navigation. The prior
    // page passed the token to a client component that only displayed success;
    // it never called verifyEmail and therefore never updated the database.
    const query = new URLSearchParams({ token, callbackURL: "/verify-email?verified=1" });
    redirect(`/api/auth/verify-email?${query.toString()}`);
  }

  const verifyResult = typeof params.error === "string" ? "failed" : params.verified === "1" ? "success" : "waiting";

  return (
    <FuturisticAuth
      initialView="verify"
      verifyResult={verifyResult}
      oauth={{ google: env.googleOAuthEnabled, github: env.githubOAuthEnabled }}
    />
  );
}
