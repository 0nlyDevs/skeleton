import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/utils";

export interface UserChipUser {
  readonly id: string;
  readonly name: string;
  readonly username: string | null;
  readonly image: string | null;
}

/** Avatar + name (+ @handle) linking to the public profile. */
export function UserChip({
  user,
  size = "md",
  meta,
  className,
}: {
  readonly user: UserChipUser;
  readonly size?: "sm" | "md";
  readonly meta?: React.ReactNode;
  readonly className?: string;
}) {
  const href = user.username ? `/u/${encodeURIComponent(user.username)}` : undefined;
  const avatar = (
    <Avatar className={size === "sm" ? "size-7" : "size-9"}>
      {user.image ? <AvatarImage src={user.image} alt="" /> : null}
      <AvatarFallback className="text-[11px]">{initials(user.name)}</AvatarFallback>
    </Avatar>
  );

  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      {href ? (
        <Link href={href} aria-hidden tabIndex={-1} className="shrink-0">
          {avatar}
        </Link>
      ) : (
        avatar
      )}
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="flex min-w-0 items-baseline gap-1.5">
          {href ? (
            <Link href={href} className="truncate text-[13.5px] font-semibold hover:underline">
              {user.name}
            </Link>
          ) : (
            <span className="truncate text-[13.5px] font-semibold">{user.name}</span>
          )}
          {user.username ? (
            <span className="truncate text-[12px] text-muted-foreground">@{user.username}</span>
          ) : null}
        </span>
        {meta ? <span className="text-[11.5px] text-muted-foreground">{meta}</span> : null}
      </div>
    </div>
  );
}
