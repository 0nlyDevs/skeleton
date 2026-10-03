import type { Metadata } from "next";
import { FuturisticAuth } from "@/components/auth/futuristic/futuristic-auth";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : undefined;

  return (
    <FuturisticAuth
      initialView="reset"
      resetToken={token}
      oauth={{ google: env.googleOAuthEnabled, github: env.githubOAuthEnabled }}
    />
  );
}
