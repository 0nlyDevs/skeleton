import type { Metadata } from "next";
import Link from "@/components/ui/link";

import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getServerDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

/**
 * Reset page.
 *
 * A missing token is handled here rather than inside the form: the user cannot do
 * anything useful without one, so the page shows a single clear instruction and a
 * way back to the request form instead of a disabled input.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t } = await getServerDictionary();
  const params = await searchParams;

  const token = typeof params.token === "string" ? params.token : undefined;

  if (!token) {
    return (
      <AuthCard title={t("auth.reset.title")}>
        <div className="flex flex-col gap-5">
          <Alert variant="warning">
            <AlertDescription className="text-foreground">
              {t("auth.reset.missing_token")}
            </AlertDescription>
          </Alert>
          <Button asChild size="lg">
            <Link href="/forgot-password">{t("auth.forgot.submit")}</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("auth.reset.title")} subtitle={t("auth.reset.subtitle")}>
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
