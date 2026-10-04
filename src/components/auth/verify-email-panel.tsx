"use client";

import { AlertCircle, CheckCircle2, MailCheck } from "lucide-react";
import Link from "@/components/ui/link";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/forms/form-field";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth/client";

type Phase = "idle" | "verified" | "failed";

/**
 * Email verification.
 *
 * Three states in one panel, because they are the same page to the user:
 *
 *  * BetterAuth verifies token links in the page request and redirects back
 *    with a result flag, so this flow does not depend on client hydration;
 *  * arriving **without** one — right after signing up — shows "check your inbox"
 *    and offers a resend;
 *  * an expired or already-used token offers the resend too, which is the only
 *    useful action at that point.
 *
 */
export function VerifyEmailPanel({ initialPhase = "idle" }: { readonly initialPhase?: Phase }) {
  const t = useTranslation();

  const phase = initialPhase;
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (resending || email.trim().length === 0) return;

      setResending(true);
      try {
        await authClient.sendVerificationEmail({
          email: email.trim(),
          callbackURL: "/space",
        });
      } catch {
        // Reported as success regardless: the endpoint is deliberately blind to
        // whether the address exists.
      } finally {
        setResending(false);
        setResent(true);
        toast.success(t("auth.verify.resent"));
      }
    },
    [email, resending, t],
  );

  if (phase === "verified") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-success/12 text-success">
          <CheckCircle2 className="size-5" />
        </span>
        <p className="text-[0.875rem] leading-relaxed text-muted-foreground">
          {t("auth.verify.success")}
        </p>
        <Button asChild size="lg" className="w-full">
          <Link href="/space">{t("tn.nav.my_space")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {phase === "failed" ? (
        <Alert variant="error">
          <AlertCircle />
          <AlertDescription className="text-foreground">{t("auth.verify.failed")}</AlertDescription>
        </Alert>
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-surface px-4 py-3">
          <MailCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
            {t("auth.register.success_body", { email: email || "…" })}
          </p>
        </div>
      )}

      <form onSubmit={handleResend} className="flex flex-col gap-4" noValidate>
        <FormField label={t("auth.login.email")}>
          {(field) => (
            <Input
              {...field}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              placeholder="nom@exemple.fr"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}
        </FormField>

        <Button
          type="submit"
          variant="secondary"
          size="lg"
          disabled={resending || email.trim().length === 0}
        >
          {resending ? <Spinner className="size-4" /> : null}
          {resent ? t("auth.verify.resent") : t("auth.verify.resend")}
        </Button>
      </form>

      <Button asChild variant="ghost" size="sm" className="self-center">
        <Link href="/login">{t("auth.register.sign_in")}</Link>
      </Button>
    </div>
  );
}
