import { FileQuestion } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getDictionary, getLocale } from "@/lib/i18n/server";

/**
 * Inline 404 for a missing record inside the app shell.
 *
 * `notFound()` from a server component renders the root not-found page, which is
 * the public chrome. This panel exists for the cases where the shell is already
 * mounted and the missing thing is just the record: same message, same actions,
 * but it keeps the sidebar and the topbar in place.
 */
export async function NotFoundPanel({ backHref = "/posts" }: { readonly backHref?: string }) {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border/80 bg-surface/50 px-6 py-16 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <FileQuestion className="size-5" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-medium">{t["feedback.not_found.title"]}</p>
        <p className="text-[13.5px] text-muted-foreground">{t["feedback.not_found.body"]}</p>
      </div>
      <Button asChild size="sm" variant="secondary">
        <Link href={backHref}>{t["common.back"]}</Link>
      </Button>
    </div>
  );
}
