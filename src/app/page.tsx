import { CtaSection } from "@/components/landing/cta-section";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { Hero } from "@/components/landing/hero";
import { LiveStats } from "@/components/landing/live-stats";
import { StackSection } from "@/components/landing/stack-section";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getDictionary, getLocale } from "@/lib/i18n/server";

/**
 * Landing page.
 *
 * Fully server rendered. Only three small client islands exist on this page — the
 * theme toggle, the language toggle and the scroll-reveal wrapper — so the first
 * byte carries the whole page and it stays readable with JavaScript disabled.
 *
 * The sections are separate components rather than one long file, which keeps each
 * under a screenful and makes the page trivially reorderable when the subject
 * changes at H0.
 */
export default async function LandingPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="flex-1">
        <Hero t={t} />
        <LiveStats t={t} />
        <FeatureGrid t={t} />
        <StackSection t={t} />
        <CtaSection t={t} />
      </main>

      <SiteFooter />
    </div>
  );
}
