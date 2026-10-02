"use client";

import { ServerErrorPage } from "@/components/feedback/server-error-page";

/** Route-level 500: the failure stays on this page, the app stays usable. */
export default function AppError({ error, reset }: { readonly error: Error & { digest?: string }; readonly reset: () => void }) {
  return <ServerErrorPage error={error} reset={reset} />;
}
