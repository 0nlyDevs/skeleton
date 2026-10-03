import {
  Accessibility,
  BookOpen,
  Bookmark,
  BusFront,
  Briefcase,
  Building2,
  FileText,
  Globe2,
  LayoutDashboard,
  Map as MapIcon,
  Megaphone,
  MessageCircle,
  Newspaper,
  Send,
  ShieldCheck,
  Siren,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { MessageKey } from "@/lib/i18n";
import type { Role } from "@/types";

export interface ShellNavItem {
  readonly href: string;
  readonly labelKey: MessageKey;
  readonly icon: LucideIcon;
  readonly badge?: "messages" | "notifications";
  readonly roles?: readonly Role[];
}

export interface ShellNavGroup {
  /** No label for the first group: "My space" stands on its own. */
  readonly labelKey: MessageKey | null;
  readonly items: readonly ShellNavItem[];
}

/**
 * Navigation by intent, not by feature: the resident's hub first, then
 * "get something done", "know what is happening in my city" and the
 * community. Notifications and settings live in the top bar; the rarely used
 * pages sit under "More". The logo is the way home.
 */
export const NAV_GROUPS: readonly ShellNavGroup[] = [
  { labelKey: null, items: [{ href: "/space", labelKey: "tn.nav.my_space", icon: LayoutDashboard }] },
  {
    labelKey: "tn.nav.group.procedures",
    items: [
      { href: "/services", labelKey: "tn.nav.services", icon: Building2 },
      { href: "/contact", labelKey: "tn.nav.request", icon: Send },
    ],
  },
  {
    labelKey: "tn.nav.group.city",
    items: [
      { href: "/alerts", labelKey: "tn.nav.alerts", icon: Siren },
      { href: "/city-map", labelKey: "tn.nav.city_map", icon: Globe2 },
      { href: "/transports", labelKey: "tn.nav.transports", icon: BusFront },
      { href: "/announcements", labelKey: "tn.nav.announcements", icon: Megaphone },
    ],
  },
  {
    labelKey: "tn.nav.group.community",
    items: [
      { href: "/feed", labelKey: "nav.feed", icon: Newspaper },
      { href: "/messages", labelKey: "nav.messages", icon: MessageCircle, badge: "messages" },
      { href: "/groups", labelKey: "nav.groups", icon: UsersRound },
    ],
  },
];

/** Under "More": useful, but not where a resident starts. */
export const MORE_NAV: readonly ShellNavItem[] = [
  { href: "/assistant", labelKey: "nav.assistant", icon: Sparkles },
  { href: "/pages", labelKey: "nav.pages", icon: FileText },
  { href: "/saved", labelKey: "nav.saved", icon: Bookmark },
  { href: "/map", labelKey: "nav.map", icon: MapIcon },
  { href: "/glossary", labelKey: "tn.glossary.nav", icon: BookOpen },
  { href: "/accessibility", labelKey: "tn.a11y.nav", icon: Accessibility },
];

/** What a guest can open without an account. */
export const GUEST_NAV: readonly ShellNavItem[] = [
  { href: "/services", labelKey: "tn.nav.services", icon: Building2 },
  { href: "/alerts", labelKey: "tn.nav.alerts", icon: Siren },
  { href: "/city-map", labelKey: "tn.nav.city_map", icon: Globe2 },
  { href: "/transports", labelKey: "tn.nav.transports", icon: BusFront },
  { href: "/announcements", labelKey: "tn.nav.announcements", icon: Megaphone },
  { href: "/feed", labelKey: "nav.feed", icon: Newspaper },
  { href: "/glossary", labelKey: "tn.glossary.nav", icon: BookOpen },
  { href: "/accessibility", labelKey: "tn.a11y.nav", icon: Accessibility },
];

/** Staff: one door each; their workspaces have their own navigation. */
export const STAFF_NAV: readonly ShellNavItem[] = [
  { href: "/agent", labelKey: "tn.nav.agent", icon: Briefcase, roles: ["AGENT", "ADMIN"] },
  { href: "/admin", labelKey: "nav.admin", icon: ShieldCheck, roles: ["ADMIN"] },
];

/** Every destination, for lookups by href. */
export const ALL_NAV: readonly ShellNavItem[] = [...NAV_GROUPS.flatMap((group) => group.items), ...MORE_NAV, ...GUEST_NAV];

export const PROFILE_ICON = UserRound;

export function isActive(pathname: string, href: string): boolean {
  if (href === "/feed") return pathname === "/feed" || pathname.startsWith("/feed/");
  if (href === "/admin") return pathname.startsWith("/admin");
  return pathname === href || pathname.startsWith(`${href}/`);
}
