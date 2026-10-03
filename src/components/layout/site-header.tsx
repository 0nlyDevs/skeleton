import Link from "@/components/ui/link";

import { Button } from "@/components/ui/button";
import { getAuthContext } from "@/lib/auth/session";
import { getDictionary, getLocale } from "@/lib/i18n/server";

import { Brand } from "./brand";
import { LocaleToggle } from "./locale-toggle";
import { EcoToggle } from "./eco-toggle";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

/**
 * Public header for the landing and legal pages.
 *
 * Rendered on the server: it reads the locale from the cookie directly, so the
 * marketing copy is already translated in the first HTML byte rather than
 * swapping after hydration. Only the two controls need client JavaScript.
 */
export async function SiteHeader() {
  const [locale, context] = await Promise.all([getLocale(), getAuthContext()]);
  const t = getDictionary(locale);
  const user = context?.user ?? null;

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 lg:px-8">
        <Brand />

        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label={t["landing.nav_label"]}>
          <Link
            href="/services"
            className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            {t["tn.nav.services"]}
          </Link>
          <Link
            href="/annonces"
            className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            {t["tn.nav.announcements"]}
          </Link>
          <Link
            href="/contact"
            className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            {t["tn.nav.contact"]}
          </Link>
          <Link
            href="/feed"
            className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            {t["tn.nav.city_life"]}
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
            <Link href="/services">{t["tn.nav.services"]}</Link>
          </Button>
          <LocaleToggle />
          <EcoToggle />
          <ThemeToggle />
          {user ? (
            <UserMenu id={user.id} username={user.username ?? null} name={user.name} email={user.email} image={user.image ?? null} role={user.role} />
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">{t["auth.login.submit"]}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">{t["auth.login.create"]}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
