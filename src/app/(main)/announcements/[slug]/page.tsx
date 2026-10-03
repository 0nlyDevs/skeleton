import { ArrowLeft, Pencil } from "lucide-react";
import type { Metadata } from "next";

import { AnnouncementCategoryBadge } from "@/components/city/announcement-card";
import { NotFoundPanel } from "@/components/feedback/not-found-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { isStaff } from "@/lib/auth/guards";
import { getAuthContext } from "@/lib/auth/session";
import { NotFoundError } from "@/lib/errors";
import { formatLongDate } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { getServerDictionary } from "@/lib/i18n/server";
import { getAnnouncement } from "@/modules/announcements/announcements.service";
import { announcementSlugParamSchema } from "@/modules/announcements/announcements.schema";

export const metadata: Metadata = { title: "Annonce" };

/** D06 — one announcement, readable by everyone once published. */
export default async function AnnouncementPage({ params }: { readonly params: Promise<{ slug: string }> }) {
  const parsed = announcementSlugParamSchema.safeParse(await params);
  const { t, locale } = await getServerDictionary();
  const context = await getAuthContext();
  const viewer = context?.user ?? null;

  const announcement = parsed.success
    ? await getAnnouncement(parsed.data.slug, viewer).catch((error: unknown) => {
        if (error instanceof NotFoundError) return null;
        throw error;
      })
    : null;
  if (!announcement) return <NotFoundPanel backHref="/announcements" />;

  return (
    <article className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
      <div className="flex items-center justify-between gap-2 px-1">
        <Link href="/announcements" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          {t("tn.news.back")}
        </Link>
        {viewer && isStaff(viewer) ? (
          <Button asChild size="sm" variant="secondary">
            <Link href={`/agent/announcements/${announcement.slug}`}>
              <Pencil aria-hidden />
              {t("tn.news.edit")}
            </Link>
          </Button>
        ) : null}
      </div>

      {announcement.coverImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- served by the authorised file route
        <img src={announcement.coverImage} alt="" className="eco-hide aspect-[2/1] w-full rounded-2xl object-cover" />
      ) : null}

      <header className="flex flex-col gap-2 px-1">
        <div className="flex flex-wrap items-center gap-2">
          <AnnouncementCategoryBadge category={announcement.category} label={t(`tn.category.${announcement.category}` as MessageKey)} />
          {!announcement.publishedAt ? <Badge variant="warning">{t("tn.draft")}</Badge> : null}
          {announcement.service ? (
            <Link href={`/services/${announcement.service.slug}`} className="text-[13px] text-primary hover:underline">
              {announcement.service.name}
            </Link>
          ) : null}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{announcement.title}</h1>
        <p className="text-[15px] text-muted-foreground">{announcement.summary}</p>
        {announcement.publishedAt ? (
          <p className="text-[13px] text-muted-foreground">
            {t("tn.news.published", { date: formatLongDate(announcement.publishedAt, locale) })} · {t("tn.city_team")}
          </p>
        ) : null}
      </header>

      <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-panel">
        <p className="prose-body text-[15px]">{announcement.body}</p>
      </div>
    </article>
  );
}
