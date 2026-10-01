import {
  Bell,
  FileText,
  Heart,
  LayoutDashboard,
  MessagesSquare,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
  Users,
  UserSearch,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { MessageKey } from "@/lib/i18n";
import type { Role } from "@/types";

/**
 * Navigation, defined once.
 *
 * The sidebar, the mobile drawer and the breadcrumb all read this list, so a new
 * page appears in all three places at once. `roles` is what the UI uses to hide
 * an entry — and the API independently enforces the same rule, which is the only
 * way hiding something in the UI is ever safe.
 */
export interface NavItem {
  readonly href: string;
  readonly labelKey: MessageKey;
  readonly icon: LucideIcon;
  /** Omitted means visible to every authenticated role. */
  readonly roles?: readonly Role[];
  readonly group: "main" | "account" | "admin";
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/feed", labelKey: "nav.feed", icon: Heart, group: "main" },
  { href: "/search", labelKey: "nav.search", icon: UserSearch, group: "main" },
  {
    href: "/dashboard",
    labelKey: "nav.dashboard",
    icon: LayoutDashboard,
    group: "main",
  },
  { href: "/posts", labelKey: "nav.posts", icon: FileText, group: "main" },
  { href: "/chat", labelKey: "nav.chat", icon: MessagesSquare, group: "main" },
  {
    href: "/notifications",
    labelKey: "nav.notifications",
    icon: Bell,
    group: "main",
  },
  { href: "/ai", labelKey: "nav.assistant", icon: Sparkles, group: "main" },

  {
    href: "/admin",
    labelKey: "nav.admin",
    icon: ShieldCheck,
    roles: ["MODERATOR", "ADMIN"],
    group: "admin",
  },
  {
    href: "/admin/users",
    labelKey: "nav.users",
    icon: Users,
    roles: ["ADMIN"],
    group: "admin",
  },
  {
    href: "/admin/moderation",
    labelKey: "nav.moderation",
    icon: ShieldCheck,
    roles: ["MODERATOR", "ADMIN"],
    group: "admin",
  },
  {
    href: "/admin/audit",
    labelKey: "nav.audit",
    icon: ScrollText,
    roles: ["ADMIN"],
    group: "admin",
  },
  {
    href: "/admin/settings",
    labelKey: "nav.flags",
    icon: SlidersHorizontal,
    roles: ["ADMIN"],
    group: "admin",
  },

  { href: "/settings/profile", labelKey: "nav.profile", icon: Settings, group: "account" },
  {
    href: "/settings/security",
    labelKey: "nav.security",
    icon: ShieldCheck,
    group: "account",
  },
  {
    href: "/settings/notifications",
    labelKey: "nav.preferences",
    icon: Bell,
    group: "account",
  },
];

export const GROUP_LABELS: Record<NavItem["group"], MessageKey | null> = {
  main: null,
  admin: "nav.admin",
  account: "nav.settings",
};

/** Items this role may see. */
export function navItemsForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}

/** True when `pathname` is inside `href` (or equal to it). */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
