import { MessageSquareHeart } from "lucide-react";
import type { Metadata } from "next";

import { FeedbackTrail } from "@/components/city/feedback-trail";
import { EmptyState } from "@/components/feedback/empty-state";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { requirePageAuth } from "@/lib/auth/page-guards";
import { formatDateTime } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { getServerDictionary } from "@/lib/i18n/server";
import { listServiceFeedback } from "@/modules/service-feedback/service-feedback.service";

export const metadata: Metadata = { title: "Mes avis" };

/** F76 — every comment the resident left, and what became of each one. */
export default async function MyFeedbackPage() {
  const { user } = await requirePageAuth("/space/feedback");
  const [{ t, locale }, page] = await Promise.all([getServerDictionary(), listServiceFeedback({ scope: "mine", page: 1, limit: 50 }, user)]);

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
      <Breadcrumbs label={t("tn.breadcrumb.label")} items={[{ label: t("tn.nav.home"), href: "/" }, { label: t("tn.nav.my_space"), href: "/space" }, { label: t("tn.feedback.mine.title") }]} />
      <header className="flex flex-col gap-1 px-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("tn.feedback.mine.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("tn.feedback.mine.subtitle")}</p>
      </header>

      {page.data.length === 0 ? (
        <EmptyState
          icon={MessageSquareHeart}
          title={t("tn.feedback.mine.empty_title")}
          description={t("tn.feedback.mine.empty_body")}
          action={
            <Button asChild size="sm">
              <Link href="/services">{t("tn.nav.services")}</Link>
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {page.data.map((item) => (
            <li key={item.reference} id={item.reference} className="flex scroll-mt-24 flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-panel target:border-primary/50">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">
                  <Link href={`/services/${item.service.slug}`} className="hover:underline">{item.service.name}</Link>
                </p>
                <p className="font-mono text-[0.8125rem] text-muted-foreground">{item.reference}</p>
              </div>
              <p className="text-[0.8125rem] text-muted-foreground">
                {t(`tn.feedback.rating.${item.rating}` as MessageKey)} · {t("tn.feedback.rating_out_of", { rating: item.rating })}
                {item.request ? ` · ${t("tn.feedback.about_request", { reference: item.request.reference })}` : ""}
              </p>
              <p className="prose-body text-[0.9375rem]">{item.comment}</p>
              <FeedbackTrail
                status={item.status}
                dates={{
                  received: formatDateTime(item.createdAt, locale),
                  read: item.readAt ? formatDateTime(item.readAt, locale) : null,
                  answered: item.repliedAt ? formatDateTime(item.repliedAt, locale) : null,
                }}
                t={t}
              />
              {item.reply ? (
                <div className="rounded-xl bg-surface-muted px-3 py-2.5">
                  <p className="mb-1 text-[0.75rem] font-semibold text-muted-foreground">{t("tn.feedback.reply_from", { service: item.service.name })}</p>
                  <p className="prose-body text-[0.9062rem]">{item.reply}</p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
