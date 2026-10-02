"use client";

import { AlertCircle } from "lucide-react";
import Link from "@/components/ui/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { FormField } from "@/components/forms/form-field";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { twoFactor } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

type Mode = "totp" | "backup";

/**
 * Two-factor challenge.
 *
 * The code field is a single input rather than six boxes: paste works, password
 * managers work, and there is no focus juggling to get wrong on a phone. It is
 * `inputMode="numeric"` with `one-time-code` autocomplete so iOS offers the code
 * from Messages.
 *
 * The two modes are separate endpoints on purpose — a backup code is consumed,
 * a TOTP code is not, and mixing them into one field would make "did this attempt
 * burn a code?" ambiguous for both the user and the audit trail.
 */
export function TwoFactorForm() {
  const t = useTranslation();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>("totp");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [errorKey, setErrorKey] = useState<"auth.twofa.invalid" | "auth.login.too_many" | "auth.login.network" | null>(
    null,
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || code.trim().length === 0) return;

    setPending(true);
    setErrorKey(null);

    try {
      const result =
        mode === "totp"
          ? await twoFactor.verifyTotp({ code: code.trim() })
          : await twoFactor.verifyBackupCode({ code: code.trim() });

      if (result.error) {
        setErrorKey(result.error.status === 429 ? "auth.login.too_many" : "auth.twofa.invalid");
        setCode("");
        inputRef.current?.focus();
        setPending(false);
        return;
      }

      router.replace("/feed");
      router.refresh();
    } catch {
      setErrorKey("auth.login.network");
      setPending(false);
    }
  };

  const switchMode = () => {
    setMode((current) => (current === "totp" ? "backup" : "totp"));
    setCode("");
    setErrorKey(null);
    inputRef.current?.focus();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      {errorKey ? (
        <Alert variant="error">
          <AlertCircle />
          <AlertDescription className="text-foreground">{t(errorKey)}</AlertDescription>
        </Alert>
      ) : null}

      <FormField
        label={mode === "totp" ? t("auth.twofa.code") : t("auth.twofa.backup_code")}
        {...(mode === "totp" ? { hint: t("auth.twofa.subtitle") } : {})}
      >
        {(field) => (
          <Input
            {...field}
            ref={inputRef}
            autoFocus
            autoComplete="one-time-code"
            inputMode={mode === "totp" ? "numeric" : "text"}
            pattern={mode === "totp" ? "[0-9]*" : undefined}
            maxLength={mode === "totp" ? 6 : 32}
            placeholder={mode === "totp" ? "000000" : "XXXX-XXXX"}
            value={code}
            onChange={(event) =>
              setCode(mode === "totp" ? event.target.value.replace(/\D/g, "") : event.target.value)
            }
            className={cn(
              "text-center font-mono tracking-[0.35em]",
              mode === "backup" && "tracking-normal",
            )}
          />
        )}
      </FormField>

      <Button type="submit" size="lg" disabled={pending || code.trim().length === 0}>
        {pending ? <Spinner className="size-4" /> : null}
        {pending ? t("common.loading") : t("auth.twofa.submit")}
      </Button>

      <div className="flex flex-col items-center gap-2 text-center">
        <button
          type="button"
          onClick={switchMode}
          className="text-[13px] font-medium text-primary underline-offset-4 hover:underline"
        >
          {mode === "totp" ? t("auth.twofa.use_backup") : t("auth.twofa.code")}
        </button>
        <Link
          href="/login"
          className="text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t("common.back")}
        </Link>
      </div>
    </form>
  );
}
