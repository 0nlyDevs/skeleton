import { Megaphone } from "lucide-react";
import type { Metadata } from "next";

import { AnnouncementCard } from "@/components/city/announcement-card";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { getAuthContext } from "@/lib/auth/session";
import type { MessageKey } from "@/lib/i18n";
import { getServerDictionary } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import { listAnnouncements } from "@/modules/announcements/announcements.service";
import { ANNOUNCEMENT_CATEGORIES, listAnnouncementsQuerySchema } from "@/modules/announcements/announcements.schema";

export const metadata: Metadata = { title: "Annonces de la ville" };

function pageHref(category: string | undefined, page: number): string {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/announcements?${query}` : "/announcements";
}

/** D06 — the city's announcements, filterable by category, pinned first. */
export default async function AnnouncementsPage({ searchParams }: { readonly searchParams: Promise<Record<string, string | undefined>> }) {
  const query = listAnnouncementsQuerySchema.safeParse(await searchParams).data ?? { page: 1, limit: 12 };
  const { t } = await getServerDictionary();
  const context = await getAuthContext();
  const result = await listAnnouncements({ ...query, drafts: undefined }, context?.user ?? null);

  const filters: { value: string | undefined; label: string }[] = [
    { value: undefined, label: t("tn.category.all") },
    ...ANNOUNCEMENT_CATEGORIES.map((category) => ({ value: category, label: t(`tn.category.${category}` as MessageKey) })),
  ];

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
      <header className="flex flex-col gap-1 px-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("tn.news.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("tn.news.subtitle")}</p>
      </header>

      <nav aria-label={t("common.filter")} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {filters.map((filter) => {
          const active = filter.value === query.category;
          return (
            <Link
              key={filter.label}
              href={pageHref(filter.value, 1)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-surface-muted",
              )}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      {result.data.length === 0 ? (
        <EmptyState icon={Megaphone} title={t("tn.news.empty_title")} description={t("tn.news.empty_body")} />
      ) : (
        <ul className="flex flex-col gap-3">
          {result.data.map((announcement) => (
            <li key={announcement.id}>
              <AnnouncementCard announcement={announcement} />
            </li>
          ))}
        </ul>
      )}

      {result.pageCount > 1 ? (
        <nav className="flex items-center justify-between gap-2" aria-label={t("common.page")}>
          <Button asChild variant="secondary" size="sm" className={cn(result.page <= 1 && "pointer-events-none opacity-50")}>
            <Link href={pageHref(query.category, result.page - 1)} aria-disabled={result.page <= 1}>{t("common.previous")}</Link>
          </Button>
          <span className="text-sm text-muted-foreground">{t("tn.page_of", { page: result.page, count: result.pageCount })}</span>
          <Button asChild variant="secondary" size="sm" className={cn(result.page >= result.pageCount && "pointer-events-none opacity-50")}>
            <Link href={pageHref(query.category, result.page + 1)} aria-disabled={result.page >= result.pageCount}>{t("common.next")}</Link>
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
