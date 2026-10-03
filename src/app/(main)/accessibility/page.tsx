import { BookOpen, Ear, Keyboard, MessageSquareWarning, Palette, TriangleAlert, Type } from "lucide-react";
import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { OpenShortcutsButton } from "@/components/shell/keyboard-shortcuts";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { getServerDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Accessibilité" };

/**
 * D20 — what the platform does for residents with a disability, how to use
 * it, its known limits, and how to report a barrier. Everything listed here
 * works in the normal pages: there is no separate "accessible version".
 */
export default async function AccessibilityPage() {
  const { t } = await getServerDictionary();
  const sections = [
    { id: "display", icon: Type, title: t("tn.a11y.display.title"), body: t("tn.a11y.display.body") },
    { id: "colors", icon: Palette, title: t("tn.a11y.colors.title"), body: t("tn.a11y.colors.body") },
    { id: "keyboard", icon: Keyboard, title: t("tn.a11y.keyboard.title"), body: t("tn.a11y.keyboard.body") },
    { id: "readers", icon: Ear, title: t("tn.a11y.readers.title"), body: t("tn.a11y.readers.body") },
    { id: "words", icon: BookOpen, title: t("tn.a11y.words.title"), body: t("tn.a11y.words.body") },
    { id: "limits", icon: TriangleAlert, title: t("tn.a11y.limits.title"), body: t("tn.a11y.limits.body") },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
      <Breadcrumbs label={t("tn.breadcrumb.label")} items={[{ label: t("tn.nav.home"), href: "/" }, { label: t("tn.a11y.title") }]} />
      <header className="flex flex-col gap-1 px-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("tn.a11y.title")}</h1>
        <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">{t("tn.a11y.intro")}</p>
      </header>

      {sections.map((section) => (
        <section key={section.id} aria-labelledby={`a11y-${section.id}`} className="flex gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-panel">
          <section.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div className="flex min-w-0 flex-col gap-2">
            <h2 id={`a11y-${section.id}`} className="font-semibold">{section.title}</h2>
            <p className="text-[0.9375rem] leading-relaxed text-muted-foreground">{section.body}</p>
            {section.id === "keyboard" ? (
              <OpenShortcutsButton className="w-fit text-sm font-medium text-primary underline underline-offset-2">{t("tn.a11y.keyboard.cta")}</OpenShortcutsButton>
            ) : null}
            {section.id === "words" ? (
              <Link href="/glossary" className="w-fit text-sm font-medium text-primary underline underline-offset-2">
                {t("tn.a11y.words.cta")}
              </Link>
            ) : null}
          </div>
        </section>
      ))}

      <section aria-labelledby="a11y-report" className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-accent/50 p-5">
        <h2 id="a11y-report" className="flex items-center gap-2 font-semibold">
          <MessageSquareWarning className="size-5 text-primary" aria-hidden />
          {t("tn.a11y.report.title")}
        </h2>
        <p className="text-[0.9375rem] leading-relaxed">{t("tn.a11y.report.body")}</p>
        <Button asChild className="w-fit">
          <Link href="/contact?topic=accessibility">{t("tn.a11y.report.cta")}</Link>
        </Button>
      </section>
    </div>
  );
}
