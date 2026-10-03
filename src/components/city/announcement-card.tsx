import { Megaphone, Pin } from "lucide-react";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import Link from "@/components/ui/link";
import { formatDate } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { getServerDictionary } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import type { AnnouncementDto } from "@/modules/announcements/announcements.service";

const CATEGORY_VARIANT: Readonly<Record<string, BadgeProps["variant"]>> = {
  ALERT: "error",
  SERVICE_CHANGE: "warning",
  EVENT: "success",
  PRACTICAL: "outline",
  ANNOUNCEMENT: "primary",
};

export function AnnouncementCategoryBadge({ category, label }: { readonly category: string; readonly label: string }) {
  return <Badge variant={CATEGORY_VARIANT[category] ?? "neutral"}>{label}</Badge>;
}

/** One announcement in a list: category, title, summary, date. */
export async function AnnouncementCard({
  announcement,
  compact = false,
  href,
}: {
  readonly announcement: AnnouncementDto;
  readonly compact?: boolean;
  readonly href?: string;
}) {
  const { t, locale } = await getServerDictionary();
  return (
    <Link
      href={href ?? `/announcements/${announcement.slug}`}
      className={cn(
        "flex gap-3 rounded-2xl border border-border/70 bg-card shadow-panel transition-colors hover:border-primary/40",
        compact ? "p-3.5" : "p-4",
        announcement.category === "ALERT" && "border-error/40",
      )}
    >
      {!compact ? (
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
          <Megaphone className="size-5" aria-hidden />
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <AnnouncementCategoryBadge category={announcement.category} label={t(`tn.category.${announcement.category}` as MessageKey)} />
          {announcement.pinned ? (
            <Badge variant="outline">
              <Pin className="size-3" aria-hidden />
              {t("tn.pinned")}
            </Badge>
          ) : null}
          {!announcement.publishedAt ? <Badge variant="warning">{t("tn.draft")}</Badge> : null}
          {announcement.service ? <span className="text-[0.75rem] text-muted-foreground">{announcement.service.name}</span> : null}
        </span>
        <span className="font-semibold leading-snug">{announcement.title}</span>
        <span className={cn("text-[0.8438rem] text-muted-foreground", compact ? "line-clamp-1" : "line-clamp-2")}>{announcement.summary}</span>
        {announcement.publishedAt ? (
          <time dateTime={announcement.publishedAt} className="text-[0.75rem] text-muted-foreground">
            {formatDate(announcement.publishedAt, { locale })}
          </time>
        ) : null}
      </span>
    </Link>
  );
}
