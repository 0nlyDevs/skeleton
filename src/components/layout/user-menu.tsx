"use client";

import { LogOut, Settings, ShieldCheck, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { signOut } from "@/lib/auth/client";
import type { Role } from "@/types";
import { initials } from "@/lib/utils";

/**
 * Account menu in the topbar.
 *
 * Sign-out is the only irreversible action here, so it is the only one that
 * waits for the server: the button shows a spinner until the session is actually
 * destroyed, then the router refreshes so every server component re-renders
 * without a session. A `router.push` alone would leave cached server output in
 * place, which is how a signed-out user can still see their dashboard.
 */
export function UserMenu({
  name,
  email,
  image,
  role,
}: {
  readonly name: string;
  readonly email: string;
  readonly image: string | null;
  readonly role: Role;
}) {
  const t = useTranslation();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = () => {
    setSigningOut(true);
    startTransition(async () => {
      try {
        await signOut();
      } finally {
        router.replace("/login");
        router.refresh();
      }
    });
  };

  const busy = signingOut || pending;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={name}
        className="inline-flex items-center gap-2 rounded-full p-0.5 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        <Avatar className="size-8">
          {image ? <AvatarImage src={image} alt="" /> : null}
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-60">
        <DropdownMenuLabel className="normal-case">
          <span className="block truncate text-[13px] font-semibold text-foreground">
            {name}
          </span>
          <span className="block truncate text-[12px] font-normal normal-case tracking-normal text-muted-foreground">
            {email}
          </span>
        </DropdownMenuLabel>

        {role !== "USER" ? (
          <div className="px-2.5 pb-1.5">
            <Badge variant={role === "ADMIN" ? "primary" : "neutral"}>
              <ShieldCheck className="size-3" />
              {role === "ADMIN" ? t("nav.admin") : t("nav.moderation")}
            </Badge>
          </div>
        ) : null}

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/settings/profile">
            <User />
            {t("nav.profile")}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href="/settings/security">
            <ShieldCheck />
            {t("nav.security")}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href="/settings/notifications">
            <Settings />
            {t("nav.preferences")}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          disabled={busy}
          onSelect={(event) => {
            event.preventDefault();
            handleSignOut();
          }}
        >
          {busy ? <Spinner className="size-4" /> : <LogOut />}
          {t("nav.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
