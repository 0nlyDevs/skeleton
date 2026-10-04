import type { Metadata } from "next";
import { FuturisticAuth } from "@/components/auth/futuristic/futuristic-auth";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Inscription" };

export default function RegisterPage() {
  return (
    <FuturisticAuth
      initialView="s1"
      oauth={{ google: env.googleOAuthEnabled, github: env.githubOAuthEnabled }}
    />
  );
}
