"use client";

import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useNotifications } from "@/hooks/use-notifications";
import { useTranslation } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/loading-skeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";

/**
 * Full notification list.
 *
 * The bell dropdown is for triage; this page is for history. Filters and paging
 * live here because the dropdown must stay one tap away from done, while the page
 * can afford a toolbar.
 *
 * The "unread only" toggle is a switch rather than a tab so the state is visible
 * as a setting, not a navigation.
 */
export function NotificationsView() {
  const t = useTranslation();
  const router = useRouter();

  const { items, meta, loading, error, unreadOnly, setUnreadOnly, setPage, markRead, markAllRead } =
    useNotifications();

  const totalPages = meta?.totalPages ?? 1;

  const openNotification = (id: string, read: boolean, link: string | null) => {
    if (!read) void markRead(id);
    if (link) router.push(link);
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] font-semibold tracking-[-0.015em]">
            {t("notifications.title")}
          </h1>
          <p className="text-[14px] text-muted-foreground">{t("notifications.subtitle")}</p>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-medium">
            <Switch checked={unreadOnly} onCheckedChange={setUnreadOnly} />
            {t("notifications.unread_only")}
          </label>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => void markAllRead()}
            disabled={loading || items.every((item) => item.read)}
          >
            <CheckCheck />
            {t("notifications.mark_all")}
          </Button>
        </div>
      </header>

      <Card className="overflow-hidden">
        {loading && items.length === 0 ? (
          <ListSkeleton rows={5} />
        ) : error ? (
          <div className="p-6">
            <ErrorState code={error} onRetry={() => router.refresh()} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={t("notifications.empty.title")}
            description={t("notifications.empty.body")}
            className="m-4 border-0 bg-transparent"
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border/60">
            {items.map((item) => {
              const typeKey = `notifications.type.${item.type}` as MessageKey;
              const row = (
                <>
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      item.read ? "bg-transparent" : "bg-primary",
                    )}
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span
                      className={cn(
                        "truncate text-[14px]",
                        item.read ? "text-muted-foreground" : "font-medium",
                      )}
                    >
                      {item.title}
                    </span>
                    {item.body ? (
                      <span className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
                        {item.body}
                      </span>
                    ) : null}
                    <span className="mt-0.5 flex items-center gap-2 text-[11.5px] uppercase tracking-wide text-muted-foreground/70">
                      {t(typeKey)}
                      <span aria-hidden>·</span>
                      <time dateTime={item.createdAt} className="normal-case">
                        {formatRelative(item.createdAt)}
                      </time>
                    </span>
                  </div>
                </>
              );

              const rowClass = cn(
                "flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors",
                !item.read && "bg-primary/[0.035]",
              );

              return (
                <li key={item.id}>
                  {item.link ? (
                    <Link
                      href={item.link}
                      className={cn(rowClass, "hover:bg-surface-muted")}
                      onClick={() => {
                        if (!item.read) void markRead(item.id);
                      }}
                    >
                      {row}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={cn(rowClass, "cursor-default hover:bg-surface-muted")}
                      onClick={() => openNotification(item.id, item.read, item.link)}
                    >
                      {row}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between gap-3" aria-label="Pagination">
          <Button
            variant="secondary"
            size="sm"
            disabled={(meta?.page ?? 1) <= 1}
            onClick={() => setPage((meta?.page ?? 1) - 1)}
          >
            {t("common.previous")}
          </Button>
          <span className="text-[13px] tabular-nums text-muted-foreground">
            {t("common.page")} {meta?.page ?? 1} {t("common.of")} {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={(meta?.page ?? 1) >= totalPages}
            onClick={() => setPage((meta?.page ?? 1) + 1)}
          >
            {t("common.next")}
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
