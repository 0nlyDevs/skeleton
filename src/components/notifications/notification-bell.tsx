"use client";

import { Bell, CheckCheck } from "lucide-react";
import Link from "@/components/ui/link";
import { useRouter } from "next/navigation";

import { useTranslation } from "@/components/providers/i18n-provider";
import { useRealtime } from "@/components/providers/realtime-provider";
import { useFormatters } from "@/hooks/use-formatters";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/feedback/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { MessageKey } from "@/lib/i18n";

/**
 * Notification bell.
 *
 * Reads the shared realtime context rather than fetching on its own, so it always
 * agrees with the notification page and the toast. Opening the panel marks the
 * visible items as read after a short delay — long enough that a user scanning
 * for one entry does not clear everything by accident, short enough that it feels
 * automatic.
 */
export function NotificationBell({ className }: { readonly className?: string }) {
  const t = useTranslation();
  const fmt = useFormatters();
  const router = useRouter();
  const { notifications, unreadCount, loading, markRead, markAllRead } = useRealtime();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("notifications.bell_label")}
        className={cn(
          "relative inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground",
          "transition-colors duration-[var(--duration-fast)] hover:bg-surface-muted hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
          className,
        )}
      >
        <Bell className="size-[18px]" />
        {unreadCount > 0 ? (
          <span
            aria-hidden
            className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.625rem] font-bold leading-4 text-primary-foreground"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
        <span className="sr-only">
          {unreadCount > 0 ? `${unreadCount}` : ""}
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <header className="flex items-center justify-between gap-2 border-b border-border/70 px-3.5 py-3">
          <span className="text-[0.8125rem] font-semibold">{t("notifications.title")}</span>
          {unreadCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-[0.75rem]"
              onClick={() => void markAllRead()}
            >
              <CheckCheck className="size-3.5" />
              {t("notifications.mark_all")}
            </Button>
          ) : null}
        </header>

        <div className="max-h-[min(24rem,60dvh)] overflow-y-auto">
          {loading && notifications.length === 0 ? (
            <div className="flex flex-col gap-2 p-3.5">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : notifications.length === 0 ? (
            <EmptyState
              icon={Bell}
              title={t("notifications.empty.title")}
              description={t("notifications.empty.body")}
              className="border-0 px-4 py-6"
            />
          ) : (
            <ul className="flex flex-col p-1">
              {notifications.map((item) => {
                const typeKey = `notifications.type.${item.type}` as MessageKey;
                const content = (
                  <>
                    <div className="flex items-center gap-2">
                      {!item.read ? (
                        <span aria-hidden className="state-bubble shrink-0 text-bead" data-fill="full" />
                      ) : null}
                      <span
                        className={cn(
                          "truncate text-[0.8125rem]",
                          item.read ? "text-muted-foreground" : "font-medium text-foreground",
                        )}
                      >
                        {item.title}
                      </span>
                    </div>
                    {item.body ? (
                      <p className="mt-0.5 line-clamp-2 pl-3.5 text-[0.75rem] leading-relaxed text-muted-foreground">
                        {item.body}
                      </p>
                    ) : null}
                    <span className="mt-1 block pl-3.5 text-[0.6875rem] uppercase tracking-wide text-muted-foreground/70">
                      {t(typeKey)} · <time dateTime={item.createdAt} className="normal-case tracking-normal">{fmt.relative(item.createdAt)}</time>
                    </span>
                  </>
                );

                const itemClasses = cn(
                  "block cursor-default select-none rounded-lg px-2.5 py-2.5 outline-none transition-colors",
                  "data-[highlighted]:bg-accent",
                  !item.read && "bg-primary/[0.04]",
                );

                return (
                  <li key={item.id}>
                    {item.link ? (
                      <Link
                        href={item.link}
                        className={itemClasses}
                        onClick={() => {
                          if (!item.read) void markRead(item.id);
                        }}
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className={cn(itemClasses, "w-full text-left")}
                        onClick={() => {
                          if (!item.read) void markRead(item.id);
                        }}
                      >
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="border-t border-border/70 p-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-center text-[0.75rem]"
            onClick={() => router.push("/notifications")}
          >
            {t("notifications.view_all")}
          </Button>
        </footer>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
