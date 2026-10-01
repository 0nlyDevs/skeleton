import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/utils";

import { PresenceDot } from "./presence-dot";

const SIZES = { "2xs": "size-4", xs: "size-7", sm: "size-9", md: "size-10", lg: "size-14", xl: "size-28" } as const;

/** Avatar with an optional presence dot; the one avatar used across the app. */
export function UserAvatar({
  name,
  image,
  size = "md",
  online,
  className,
}: {
  readonly name: string;
  readonly image: string | null;
  readonly size?: keyof typeof SIZES;
  readonly online?: boolean;
  readonly className?: string;
}) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <Avatar className={cn(SIZES[size], size === "xl" && "ring-4 ring-card")}>
        {image ? <AvatarImage src={image} alt="" className="object-cover" /> : null}
        <AvatarFallback className={cn(size === "xl" ? "text-3xl" : size === "2xs" ? "text-[7px]" : "text-[12px]", "font-semibold")}>
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      {online !== undefined ? <PresenceDot online={online} className={size === "xl" ? "size-5 right-2 bottom-2" : undefined} /> : null}
    </span>
  );
}
