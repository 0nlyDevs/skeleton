import type { Metadata } from "next";
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

  return (
    <FuturisticAuth
      initialView="verify"
      verifyToken={token}
      oauth={{ google: env.googleOAuthEnabled, github: env.githubOAuthEnabled }}
    />
  );
}
