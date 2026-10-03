import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";

/** Inline 403 inside the app shell: says why, and where to go instead. */
export function ForbiddenPanel({
  title,
  body,
  backHref,
  backLabel,
}: {
  readonly title: string;
  readonly body: string;
  readonly backHref: string;
  readonly backLabel: string;
}) {
  return (
    <div role="alert" className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-4 rounded-2xl border border-error/30 bg-card px-6 py-14 text-center shadow-panel">
      <span className="flex size-12 items-center justify-center rounded-full bg-error/12 text-error">
        <ShieldAlert className="size-6" aria-hidden />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="text-[0.75rem] font-semibold uppercase tracking-wide text-error">403</p>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-[0.875rem] text-muted-foreground">{body}</p>
      </div>
      <Button asChild size="sm" variant="secondary">
        <Link href={backHref}>{backLabel}</Link>
      </Button>
    </div>
  );
}
