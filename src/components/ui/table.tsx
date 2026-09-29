import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Table shell.
 *
 * The wrapper is the scroll container, not the page: a wide users table scrolls
 * inside its own card instead of forcing a horizontal scroll on the whole
 * document, which is one of the stated quality gates at 390px.
 */
export function TableWrapper({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("relative w-full overflow-x-auto overscroll-x-contain", className)}
      {...props}
    />
  );
}

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <table
      className={cn("w-full min-w-[36rem] caption-bottom border-collapse text-sm", className)}
      {...props}
    />
  );
}

export function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("[&_tr]:border-b [&_tr]:border-border/70", className)} {...props} />;
}

export function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      className={cn(
        "border-b border-border/60 transition-colors duration-[var(--duration-fast)] hover:bg-surface-muted/60",
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "h-10 whitespace-nowrap px-3 text-left align-middle text-[12px] font-semibold uppercase tracking-wide text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("px-3 py-3 align-middle", className)} {...props} />;
}

export function TableCaption({ className, ...props }: ComponentProps<"caption">) {
  return (
    <caption className={cn("mt-3 text-[13px] text-muted-foreground", className)} {...props} />
  );
}
