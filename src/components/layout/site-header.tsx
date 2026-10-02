import Link from "@/components/ui/link";

import { Button } from "@/components/ui/button";
import { getDictionary, getLocale } from "@/lib/i18n/server";

import { Brand } from "./brand";
import { LocaleToggle } from "./locale-toggle";
import { ThemeToggle } from "./theme-toggle";

/**
 * Public header for the landing and legal pages.
 *
 * Rendered on the server: it reads the locale from the cookie directly, so the
 * marketing copy is already translated in the first HTML byte rather than
 * swapping after hydration. Only the two controls need client JavaScript.
 */
export async function SiteHeader() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 lg:px-8">
        <Brand />

        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label={t["landing.nav_label"]}>
          <Link
            href="/feed"
            className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            {t["nav.feed"]}
          </Link>
          <Link
            href="/search"
            className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            {t["nav.search"]}
          </Link>
          <Link
            href="/#features"
            className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            {t["landing.features.title"]}
          </Link>
          <Link
            href="/#stack"
            className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            {t["landing.stack.title"]}
          </Link>
          <Link
            href="/privacy"
            className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            {t["footer.privacy"]}
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Button asChild variant="ghost" size="sm" className="md:hidden">
            <Link href="/feed">{t["nav.feed"]}</Link>
          </Button>
          <LocaleToggle />
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/login">{t["auth.login.submit"]}</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/register">{t["auth.login.create"]}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
