import { ChevronRight, Home } from "lucide-react";

import Link from "@/components/ui/link";
import { cn } from "@/lib/utils";

export interface Crumb {
  readonly label: string;
  /** Absent on the current page, which is the last crumb. */
  readonly href?: string;
}

/**
 * D15 — "where am I": the path from the home page to the current page, each
 * level a link back up. The first crumb is shown as a house icon with its
 * label kept for screen readers.
 */
export function Breadcrumbs({ items, label, className }: { readonly items: readonly Crumb[]; readonly label: string; readonly className?: string }) {
  return (
    <nav aria-label={label} className={cn("px-1", className)}>
      <ol className="flex flex-wrap items-center gap-1 text-[0.8125rem] text-muted-foreground">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 ? <ChevronRight className="size-3.5 shrink-0" aria-hidden /> : null}
              {item.href && !last ? (
                <Link href={item.href} className="inline-flex items-center gap-1 rounded hover:text-foreground hover:underline">
                  {index === 0 ? <Home className="size-3.5" aria-hidden /> : null}
                  <span className={index === 0 ? "sr-only sm:not-sr-only" : undefined}>{item.label}</span>
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={cn("truncate", last && "font-medium text-foreground")}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
