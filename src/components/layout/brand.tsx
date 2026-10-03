import Link from "@/components/ui/link";

import { cn } from "@/lib/utils";

/**
 * The wordmark.
 *
 * A small accent square plus the name — no logo image, nothing to load, and it
 * inherits the current theme. The square is decorative, so it is hidden from
 * assistive technology while the text carries the name.
 */
export function Brand({
  className,
  href = "/",
  compact = false,
}: {
  readonly className?: string;
  readonly href?: string | null;
  readonly compact?: boolean;
}) {
  const content = (
    <>
      <span
        aria-hidden
        className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-primary to-[oklch(0.62_0.2_310)] text-primary-foreground shadow-sm shadow-primary/30"
      >
        {/* A tiny social graph: three linked nodes. */}
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M7 16.5 12 7.5l5 9" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="6.5" r="2.4" fill="currentColor" stroke="none" />
          <circle cx="6.2" cy="17.5" r="2.4" fill="currentColor" stroke="none" />
          <circle cx="17.8" cy="17.5" r="2.4" fill="currentColor" stroke="none" />
        </svg>
      </span>
      {!compact ? <span className="text-[17px] font-bold tracking-tight">Terra Nova</span> : null}
    </>
  );

  const classes = cn("inline-flex items-center gap-2.5 rounded-lg", className);

  if (!href) return <div className={classes}>{content}</div>;

  return (
    <Link href={href} className={classes} aria-label="Terra Nova">
      {content}
    </Link>
  );
}
