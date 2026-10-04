"use client";

import { MapPin } from "lucide-react";

import { useTranslation } from "@/components/providers/i18n-provider";
import Link from "@/components/ui/link";
import type { MessageKey } from "@/lib/i18n";
import { cityZoneLabelKey, type CityZoneId } from "@/modules/alerts/city-zones";

import type { ShellRail, ShellViewer } from "./shell-types";
import { UserAvatar } from "./user-avatar";

/** Who I am in the city, at the top of the side column: name, role, district, and my place in the community. */
export function ProfileCard({ viewer, zone, rail }: { readonly viewer: ShellViewer; readonly zone: CityZoneId | null; readonly rail: ShellRail | null }) {
  const t = useTranslation();
  const profileHref = viewer.username ? `/profile/${encodeURIComponent(viewer.username)}` : "/settings/profile";
  const counts = rail
    ? ([
        { label: t("shell.followers"), value: rail.followers },
        { label: t("shell.following"), value: rail.following },
        { label: t("shell.posts"), value: rail.posts },
      ] as const)
    : [];
  return (
    <section aria-label={t("nav.my_profile")} className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-panel">
      <Link href={profileHref} className="flex items-center gap-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
        <UserAvatar userId={viewer.id} name={viewer.name} image={viewer.image} size="md" />
        <span className="min-w-0">
          <span className="line-clamp-2 text-[0.9375rem] font-semibold leading-tight">{viewer.name}</span>
          <span className="block truncate text-[0.8125rem] text-muted-foreground">
            {viewer.username ? `@${viewer.username}` : t(`role.${viewer.role.toLowerCase()}` as MessageKey)}
          </span>
        </span>
      </Link>
      <Link href={zone ? "/city-map" : "/settings/profile"} className="flex items-center gap-2 rounded-full bg-surface-muted px-3 py-1.5 text-[0.8125rem] font-medium hover:bg-accent">
        <MapPin className="size-3.5 shrink-0 text-primary" aria-hidden />
        <span className="truncate">{zone ? t(cityZoneLabelKey(zone)) : t("tn.nav.choose_district")}</span>
      </Link>
      {counts.length > 0 ? (
        <dl className="grid grid-cols-3 gap-1 border-t border-border/70 pt-3 text-center">
          {counts.map((count) => (
            <div key={count.label} className="flex flex-col-reverse">
              <dt className="text-[0.6875rem] leading-tight text-muted-foreground">{count.label}</dt>
              <dd className="text-[0.9375rem] font-semibold tabular-nums">{count.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
