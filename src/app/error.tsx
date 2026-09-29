"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/feedback/error-state";

/**
 * Route-level error boundary.
 *
 * Catches anything a server component or an API call throws while rendering and
 * keeps the failure contained to the page, so the rest of the app stays
 * navigable. The digest is shown instead of the stack trace: a stack trace in the
 * browser is an information leak, and the correlation id is what actually lets an
 * operator find the matching server log line.
 */
export default function AppError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    // Logged for context; the authoritative record is the server log with the
    // same digest.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4">
      <ErrorState onRetry={reset} className="w-full max-w-lg" />
      {error.digest ? (
        <p className="font-mono text-[11px] text-muted-foreground/70">ref: {error.digest}</p>
      ) : null}
    </div>
  );
}
