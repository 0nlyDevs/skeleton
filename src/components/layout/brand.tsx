import Link from "@/components/ui/link";

import { cn } from "@/lib/utils";

import { BubbleMark, BubbleWordmark } from "./bubble-logo";

/**
 * The Bubble logo: the mark, and the wordmark next to it unless `compact`.
 * The drawings are decorative for assistive technology; the link carries the
 * name.
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
      <BubbleMark className="h-8" />
      {!compact ? <BubbleWordmark className="h-[1.05rem]" /> : null}
    </>
  );

  const classes = cn("inline-flex items-center gap-2 rounded-lg", className);

  if (!href) {
    return (
      <div className={classes}>
        <span className="sr-only">Bubble</span>
        {content}
      </div>
    );
  }

  return (
    <Link href={href} className={classes} aria-label="Bubble">
      {content}
    </Link>
  );
}
