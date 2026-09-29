import { cn } from "@/lib/utils";

/**
 * Inline spinner for button-level busy states.
 *
 * A single rotating ring built from a border, not an icon font and not
 * `<Loader2 />`: an SVG arc that animates on `transform` only, so it stays on the
 * compositor. Sized in `em` so it inherits whatever text size it sits in.
 */
export function Spinner({
  className,
  label,
}: {
  readonly className?: string;
  readonly label?: string;
}) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label ?? "Loading"}
      className={cn("inline-flex items-center justify-center", className)}
    >
      <span
        aria-hidden
        className="block size-[1em] shrink-0 animate-spin rounded-full border-[1.5px] border-current border-t-transparent opacity-80"
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}

/** A centred spinner with a caption, for to fill a panel. */
export function LoadingBlock({ label }: { readonly label?: string }) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center gap-3 text-muted-foreground">
      <Spinner className="text-lg" />
      {label ? <p className="text-sm">{label}</p> : null}
    </div>
  );
}
