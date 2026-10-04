"use client";

import { Compass, LogOut, MapPin, Settings } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { LocaleToggle } from "@/components/layout/locale-toggle";
import { useTranslation } from "@/components/providers/i18n-provider";
import Link from "@/components/ui/link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { signOut } from "@/lib/auth/client";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { cityZoneLabelKey, type CityZoneId } from "@/modules/alerts/city-zones";

import { HELP_NAV, PROFILE_ICON, type ShellNavItem } from "./nav-config";
import type { ShellViewer } from "./shell-types";
import { UserAvatar } from "./user-avatar";

const ROW = "flex items-center gap-2.5 rounded-full px-3 py-2 text-[0.875rem] font-medium hover:bg-surface-muted";

function Row({ item, label, className }: { readonly item: ShellNavItem; readonly label: string; readonly className?: string }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} className={cn(ROW, className)}>
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      {label}
    </Link>
  );
}

/**
 * Everything personal behind the avatar: who I am and where I live, my
 * account, help pages, reading comfort and language, and the way out.
 * Places are in the side menu and staff workspaces in the top bar.
 */
export function AccountPanel({ viewer, zone }: { readonly viewer: ShellViewer; readonly zone: CityZoneId | null }) {
  const t = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [signingOut, setSigningOut] = useState(false);

  // A link was followed: the panel closes with the page change.
  useEffect(() => setOpen(false), [pathname]);

  const handleSignOut = () => {
    setSigningOut(true);
    startTransition(async () => {
      try {
        await signOut();
      } finally {
        // `replace` + `refresh`: no cached server output survives the session.
        router.replace("/login");
        router.refresh();
      }
    });
  };

  const busy = signingOut || pending;
  const profileHref = viewer.username ? `/profile/${encodeURIComponent(viewer.username)}` : "/settings/profile";
  const ProfileIcon = PROFILE_ICON;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={t("tn.account.open", { name: viewer.name })}
        className="inline-flex items-center rounded-full p-0.5 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <UserAvatar userId={viewer.id} name={viewer.name} image={viewer.image} size="xs" className="size-8" />
      </PopoverTrigger>
      <PopoverContent align="end" className="flex max-h-[min(42rem,calc(100dvh-5rem))] w-[19.5rem] max-w-[calc(100vw-1.5rem)] flex-col gap-1 overflow-y-auto rounded-2xl p-3">
        <div className="flex items-center gap-3 px-2 pb-1 pt-1">
          <UserAvatar userId={viewer.id} name={viewer.name} image={viewer.image} size="md" />
          <div className="min-w-0">
            <p className="truncate text-[0.9375rem] font-semibold">{viewer.name}</p>
            <p className="truncate text-[0.7812rem] text-muted-foreground">
              {t(`role.${viewer.role.toLowerCase()}` as MessageKey)}
              {viewer.username ? ` · @${viewer.username}` : ""}
            </p>
          </div>
        </div>
        <Link href={zone ? "/city-map" : "/settings/profile"} className="mx-1 mb-1 flex items-center gap-2 rounded-full bg-surface-muted px-3 py-2 text-[0.8125rem] hover:bg-accent">
          <MapPin className="size-4 shrink-0" aria-hidden />
          {zone ? (
            <span className="min-w-0 truncate">
              <span className="text-muted-foreground">{t("tn.nav.my_district")} · </span>
              <span className="font-medium">{t(cityZoneLabelKey(zone))}</span>
            </span>
          ) : (
            <span className="font-medium">{t("tn.nav.choose_district")}</span>
          )}
        </Link>

        <nav aria-label={t("tn.account.label")} className="flex flex-col">
          <Link href={profileHref} className={ROW}>
            <ProfileIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            {t("nav.my_profile")}
          </Link>
          <Link href="/settings/profile" className={ROW}>
            <Settings className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            {t("nav.settings")}
          </Link>
          {/* D12 — the welcome guide opens by itself once; here it can be replayed at will. */}
          <Link href="/space?guide=1" className={ROW}>
            <Compass className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            {t("tn.wizard.replay")}
          </Link>
          <p className="px-3 pb-1 pt-3 text-[0.75rem] font-semibold text-muted-foreground">{t("tn.account.help")}</p>
          {HELP_NAV.map((item) => (
            // The assistant already sits in the side menu on a wide screen.
            <Row key={item.href} item={item} label={t(item.labelKey)} className={item.href === "/assistant" ? "lg:hidden" : undefined} />
          ))}
        </nav>

        <section aria-label={t("display.label")} className="mt-2 flex flex-col gap-3 border-t border-border/70 px-2 pt-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">{t("tn.account.language")}</span>
            <LocaleToggle />
          </div>
        </section>

        <button type="button" disabled={busy} onClick={handleSignOut} className={`${ROW} mt-2 text-error disabled:opacity-60`}>
          {busy ? <Spinner className="size-4" /> : <LogOut className="size-4 shrink-0" aria-hidden />}
          {t("nav.logout")}
        </button>
      </PopoverContent>
    </Popover>
  );
}
