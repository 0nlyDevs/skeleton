"use client";

import { Home, RotateCcw, ServerCrash } from "lucide-react";
import Link from "@/components/ui/link";
import { useEffect } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";

/**
 * The 500 page: same tone as the 404, with a retry that re-renders the
 * segment and a way home. Only the digest is shown — never a stack trace.
 */
export function ServerErrorPage({
  error,
  reset,
  fullScreen = true,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
  readonly fullScreen?: boolean;
}) {
  const t = useTranslation();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className={fullScreen ? "flex min-h-dvh items-center justify-center px-4 py-20" : "flex items-center justify-center px-4 py-16"}>
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-error/12 text-error">
          <ServerCrash className="size-6" aria-hidden />
        </span>
        <div className="flex flex-col gap-2">
          <p className="font-mono text-[13px] font-medium text-muted-foreground">500</p>
          <h1 className="text-2xl font-semibold tracking-tight">{t("feedback.server_error.title")}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("feedback.server_error.body")}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={reset}>
            <RotateCcw />
            {t("feedback.server_error.retry")}
          </Button>
          <Button asChild variant="secondary">
            <Link href="/feed">
              <Home />
              {t("feedback.not_found.cta")}
            </Link>
          </Button>
        </div>
        {error.digest ? <p className="font-mono text-[11px] text-muted-foreground/70">ref : {error.digest}</p> : null}
      </div>
    </main>
  );
}
