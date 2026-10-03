import type { Metadata } from "next";
import { FuturisticAuth } from "@/components/auth/futuristic/futuristic-auth";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Vérification en deux étapes" };

export default function TwoFactorPage() {
  return (
    <FuturisticAuth
      initialView="2fa"
      oauth={{ google: env.googleOAuthEnabled, github: env.githubOAuthEnabled }}
    />
  );
}
