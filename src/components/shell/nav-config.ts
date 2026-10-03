import {
  Accessibility,
  Bell,
  BookOpen,
  Bookmark,
  BusFront,
  Briefcase,
  Building2,
  FolderOpen,
  Landmark,
  Megaphone,
  Send,
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

/** The city portal: what every resident comes for. */
export const CITY_NAV: readonly ShellNavItem[] = [
  { href: "/", labelKey: "tn.nav.home", icon: Landmark },
  { href: "/services", labelKey: "tn.nav.services", icon: Building2 },
  { href: "/announcements", labelKey: "tn.nav.announcements", icon: Megaphone },
  { href: "/transports", labelKey: "tn.nav.transports", icon: BusFront },
  { href: "/space", labelKey: "tn.nav.my_space", icon: FolderOpen },
  { href: "/contact", labelKey: "tn.nav.contact", icon: Send },
  { href: "/glossary", labelKey: "tn.glossary.nav", icon: BookOpen },
  { href: "/accessibility", labelKey: "tn.a11y.nav", icon: Accessibility },
  { href: "/messages", labelKey: "nav.messages", icon: MessageCircle, badge: "messages" },
  { href: "/notifications", labelKey: "nav.notifications", icon: Bell, badge: "notifications" },
];

/** "Vie de la cité": the community features, secondary to the portal. */
export const MAIN_NAV: readonly ShellNavItem[] = [
  { href: "/feed", labelKey: "nav.feed", icon: Home },
  { href: "/groups", labelKey: "nav.groups", icon: UsersRound },
  { href: "/map", labelKey: "nav.map", icon: MapIcon },
  { href: "/pages", labelKey: "nav.pages", icon: FileText },
  { href: "/saved", labelKey: "nav.saved", icon: Bookmark },
  { href: "/assistant", labelKey: "nav.assistant", icon: Sparkles },
  { href: "/settings/profile", labelKey: "nav.settings", icon: Settings },
];

/** Every destination, for lookups by href. */
export const ALL_NAV: readonly ShellNavItem[] = [...CITY_NAV, ...MAIN_NAV];

export const STAFF_NAV: readonly ShellNavItem[] = [
  { href: "/agent", labelKey: "tn.nav.agent", icon: Briefcase, roles: ["MODERATOR", "ADMIN"] },
  { href: "/admin/moderation", labelKey: "nav.moderation", icon: Gavel, roles: ["MODERATOR", "ADMIN"] },
  { href: "/admin/users", labelKey: "nav.users", icon: Users, roles: ["ADMIN"] },
  { href: "/admin/audit", labelKey: "nav.audit", icon: ScrollText, roles: ["ADMIN"] },
  { href: "/admin/settings", labelKey: "nav.flags", icon: SlidersHorizontal, roles: ["ADMIN"] },
];

export const PROFILE_ICON = UserRound;

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/feed") return pathname === "/feed" || pathname.startsWith("/feed/");
  if (href === "/settings/profile") return pathname.startsWith("/settings");
  return pathname === href || pathname.startsWith(`${href}/`);
}
