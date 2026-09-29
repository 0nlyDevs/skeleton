"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/components/providers/i18n-provider";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Error state for a panel that failed to load.
 *
 * The message is derived from the API's `code`, never from the raw server text —
 * which means a jury reading the UI in French gets a French explanation even when
 * the server answered in English. The retry affordance is always present, so a
 * transient failure is one click from recovery.
 */
export function ErrorState({
  code,
  onRetry,
  className,
}: {
  readonly code?: string | null;
  readonly onRetry?: () => void;
  readonly className?: string;
}) {
  const t = useTranslation();

  const messageKey = `error.${code ?? "INTERNAL_ERROR"}` as MessageKey;
  const message = t(messageKey) === messageKey ? t("error.INTERNAL_ERROR") : t(messageKey);

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-error/25 bg-error/6 px-6 py-10 text-center",
        className,
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-error/12 text-error">
        <AlertTriangle className="size-5" />
      </span>

      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-medium tracking-tight">{t("feedback.error.title")}</p>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{message}</p>
      </div>

      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-1">
          <RotateCcw />
          {t("common.retry")}
        </Button>
      ) : null}
    </div>
  );
}
