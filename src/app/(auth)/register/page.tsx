import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";
import { env } from "@/lib/env";
import { getServerDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Inscription" };

export default async function RegisterPage() {
  const { t } = await getServerDictionary();

  return (
    <AuthCard
      title={t("auth.register.title")}
      subtitle={t("auth.register.subtitle")}
      footer={
        <>
          {t("auth.register.have_account")}{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            {t("auth.register.sign_in")}
          </Link>
        </>
      }
    >
      <RegisterForm googleEnabled={env.googleOAuthEnabled} />
    </AuthCard>
  );
}
