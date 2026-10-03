import {
  Bell,
  Bookmark,
  FileText,
  Gavel,
  Home,
  Map as MapIcon,
  MessageCircle,
  ScrollText,
  Settings,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  Users,
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
  /** Hidden when the deployment cannot serve it (see `visibleNavItems`). */
  readonly requiresAi?: boolean;
}

/** One navigation model for the whole product; staff items are server-enforced too. */
export const MAIN_NAV: readonly ShellNavItem[] = [
  { href: "/feed", labelKey: "nav.feed", icon: Home },
  { href: "/messages", labelKey: "nav.messages", icon: MessageCircle, badge: "messages" },
  { href: "/groups", labelKey: "nav.groups", icon: UsersRound },
  { href: "/map", labelKey: "nav.map", icon: MapIcon },
  { href: "/pages", labelKey: "nav.pages", icon: FileText },
  { href: "/saved", labelKey: "nav.saved", icon: Bookmark },
  { href: "/notifications", labelKey: "nav.notifications", icon: Bell, badge: "notifications" },
  { href: "/assistant", labelKey: "nav.assistant", icon: Sparkles, requiresAi: true },
  { href: "/settings/profile", labelKey: "nav.settings", icon: Settings },
];

export const STAFF_NAV: readonly ShellNavItem[] = [
  { href: "/admin/moderation", labelKey: "nav.moderation", icon: Gavel, roles: ["MODERATOR", "ADMIN"] },
  { href: "/admin/users", labelKey: "nav.users", icon: Users, roles: ["ADMIN"] },
  { href: "/admin/audit", labelKey: "nav.audit", icon: ScrollText, roles: ["ADMIN"] },
  { href: "/admin/settings", labelKey: "nav.flags", icon: SlidersHorizontal, roles: ["ADMIN"] },
];

export const PROFILE_ICON = UserRound;

/**
 * Navigation the deployment can actually serve.
 *
 * A feature whose backing service is unavailable stays reachable by URL — it
 * renders its own "not configured" state — but it is dropped from the menu, so
 * the product never advertises a dead end. `aiEnabled` is resolved on the
 * server, where the AI circuit breaker lives, and passed down as a prop.
 */
export function visibleNavItems(
  items: readonly ShellNavItem[],
  aiEnabled: boolean,
): readonly ShellNavItem[] {
  return items.filter((item) => !item.requiresAi || aiEnabled);
}

export function isActive(pathname: string, href: string): boolean {
  if (href === "/feed") return pathname === "/feed" || pathname.startsWith("/feed/");
  if (href === "/settings/profile") return pathname.startsWith("/settings");
  return pathname === href || pathname.startsWith(`${href}/`);
}
