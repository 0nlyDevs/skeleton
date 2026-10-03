import Link from "@/components/ui/link";

import { getDictionary, getLocale } from "@/lib/i18n/server";

import { Brand } from "./brand";

/**
 * Public footer.
 *
 * The health link is deliberate: it gives a jury member a one-click way to check
 * that the deployment is alive without reading documentation.
 */
export async function SiteFooter() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <footer className="border-t border-border/70 bg-surface/40">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 lg:px-8">
        <div className="flex flex-col gap-2">
          <Brand />
          <p className="max-w-md text-[0.8125rem] leading-relaxed text-muted-foreground">
            {t["app.tagline"]}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.8125rem] text-muted-foreground">
          <Link className="transition-colors hover:text-foreground" href="/privacy">
            {t["footer.privacy"]}
          </Link>
          <Link className="transition-colors hover:text-foreground" href="/terms">
            {t["footer.terms"]}
          </Link>
          <a className="transition-colors hover:text-foreground" href="/api/health">
            {t["footer.health"]}
          </a>
        </div>

        <p className="text-[0.75rem] text-muted-foreground/70">
          © {new Date().getFullYear()} — {t["footer.rights"]}
        </p>
      </div>
    </footer>
  );
}
