import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Empty state.
 *
 * Always carries an action. An empty panel with no next step is a dead end, and
 * the brief is explicit that every screen must be self-explanatory without a
 * pitch — so the empty state is where a first-time user is told what to do.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  readonly icon?: LucideIcon;
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
  readonly className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 bg-surface/50 px-6 py-12 text-center",
        className,
      )}
    >
      {Icon ? (
        <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Icon className="size-5" />
        </span>
      ) : null}

      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-medium tracking-tight">{title}</p>
        {description ? (
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
