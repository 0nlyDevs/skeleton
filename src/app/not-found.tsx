import { Compass } from "lucide-react";
import Link from "@/components/ui/link";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { getDictionary, getLocale } from "@/lib/i18n/server";

/**
 * 404.
 *
 * Renders the public chrome even for signed-in users: `not-found.tsx` at the root
 * has no access to the session, and showing the marketing header is a safer
 * default than showing a bare page. The link always goes somewhere useful.
 */
export default async function NotFound() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="flex flex-1 items-center justify-center px-4 py-20">
        <div className="flex max-w-md flex-col items-center gap-5 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Compass className="size-5" />
          </span>

          <div className="flex flex-col gap-2">
            <p className="font-mono text-[0.8125rem] font-medium text-muted-foreground">404</p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t["feedback.not_found.title"]}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t["feedback.not_found.body"]}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button asChild>
              <Link href="/">{t["feedback.not_found.cta"]}</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/">{t["common.back"]}</Link>
            </Button>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
