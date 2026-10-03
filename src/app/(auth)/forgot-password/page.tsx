import type { Metadata } from "next";
import { FuturisticAuth } from "@/components/auth/futuristic/futuristic-auth";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return (
    <FuturisticAuth
      initialView="forgot"
      oauth={{ google: env.googleOAuthEnabled, github: env.githubOAuthEnabled }}
    />
  );
}
