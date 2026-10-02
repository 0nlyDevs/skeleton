"use client";

import { ServerErrorPage } from "@/components/feedback/server-error-page";

/** A 500 inside the app keeps the navigation around it. */
export default function MainError({ error, reset }: { readonly error: Error & { digest?: string }; readonly reset: () => void }) {
  return <ServerErrorPage error={error} reset={reset} fullScreen={false} />;
}
