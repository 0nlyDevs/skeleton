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
  { href: "/assistant", labelKey: "nav.assistant", icon: Sparkles },
  { href: "/settings/profile", labelKey: "nav.settings", icon: Settings },
];

export const STAFF_NAV: readonly ShellNavItem[] = [
  { href: "/admin/moderation", labelKey: "nav.moderation", icon: Gavel, roles: ["MODERATOR", "ADMIN"] },
  { href: "/admin/users", labelKey: "nav.users", icon: Users, roles: ["ADMIN"] },
  { href: "/admin/audit", labelKey: "nav.audit", icon: ScrollText, roles: ["ADMIN"] },
  { href: "/admin/settings", labelKey: "nav.flags", icon: SlidersHorizontal, roles: ["ADMIN"] },
];

export const PROFILE_ICON = UserRound;

export function isActive(pathname: string, href: string): boolean {
  if (href === "/feed") return pathname === "/feed" || pathname.startsWith("/feed/");
  if (href === "/settings/profile") return pathname.startsWith("/settings");
  return pathname === href || pathname.startsWith(`${href}/`);
}
