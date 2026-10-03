"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/utils";
import { storedSrc } from "@/lib/media";

import { useProfileOverride } from "@/hooks/use-profile-overrides";

import { PresenceDot } from "./presence-dot";

const SIZES = { "2xs": "size-4", xs: "size-7", sm: "size-9", md: "size-10", lg: "size-14", xl: "size-28" } as const;

/** Avatar with an optional presence dot; the one avatar used across the app. */
export function UserAvatar({
  userId,
  name: initialName,
  image: initialImage,
  size = "md",
  online,
  className,
}: {
  /** Enables live updates when this person changes their avatar or name. */
  readonly userId?: string;
  readonly name: string;
  readonly image: string | null;
  readonly size?: keyof typeof SIZES;
  readonly online?: boolean;
  readonly className?: string;
}) {
  const override = useProfileOverride(userId);
  const name = override?.name ?? initialName;
  const image = override ? override.image : initialImage;
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <Avatar className={cn(SIZES[size], size === "xl" && "ring-4 ring-card")}>
        {image ? <AvatarImage src={storedSrc(image, size === "xl" ? 320 : 160)} alt="" className="object-cover" /> : null}
        <AvatarFallback className={cn(size === "xl" ? "text-3xl" : size === "2xs" ? "text-[0.4375rem]" : "text-[0.75rem]", "font-semibold")}>
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      {online !== undefined ? <PresenceDot online={online} className={size === "xl" ? "size-5 right-2 bottom-2" : undefined} /> : null}
    </span>
  );
}
