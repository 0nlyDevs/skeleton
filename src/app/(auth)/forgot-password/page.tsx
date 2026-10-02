import type { Metadata } from "next";
import Link from "@/components/ui/link";

import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getServerDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default async function ForgotPasswordPage() {
  const { t } = await getServerDictionary();

  return (
    <AuthCard
      title={t("auth.forgot.title")}
      subtitle={t("auth.forgot.subtitle")}
      footer={
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          {t("auth.register.sign_in")}
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
