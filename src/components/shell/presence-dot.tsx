import { cn } from "@/lib/utils";

/** Green dot on an avatar when online; nothing otherwise (no grey noise). */
export function PresenceDot({ online, className }: { readonly online: boolean; readonly className?: string }) {
  if (!online) return null;
  return (
    <span
      aria-hidden
      className={cn(
        "absolute bottom-0 right-0 block size-3 rounded-full bg-success ring-2 ring-card",
        className,
      )}
    />
  );
}
