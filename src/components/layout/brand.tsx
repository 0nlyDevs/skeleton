import Link from "next/link";

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
        className="grid size-7 shrink-0 place-items-center rounded-[9px] bg-primary text-[11px] font-bold text-primary-foreground"
      >
        W
      </span>
      {!compact ? (
        <span className="text-[15px] font-semibold tracking-tight">
          Webcup<span className="text-muted-foreground"> Base</span>
        </span>
      ) : null}
    </>
  );

  const classes = cn("inline-flex items-center gap-2.5 rounded-lg", className);

  if (!href) return <div className={classes}>{content}</div>;

  return (
    <Link href={href} className={classes} aria-label="Webcup Base">
      {content}
    </Link>
  );
}
