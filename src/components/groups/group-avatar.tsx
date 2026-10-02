import { cn } from "@/lib/utils";

/** Initial on a gradient tile; the group's identity without an upload. */
export function GroupAvatar({ name, size = "md", className }: { readonly name: string; readonly size?: "sm" | "md" | "lg"; readonly className?: string }) {
  const sizes = { sm: "size-9 text-[13px] rounded-xl", md: "size-12 text-[17px] rounded-2xl", lg: "size-20 text-[30px] rounded-3xl" } as const;
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center bg-gradient-to-br from-primary to-[oklch(0.62_0.2_310)] font-bold text-primary-foreground",
        sizes[size],
        className,
      )}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
