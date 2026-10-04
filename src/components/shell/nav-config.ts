import {
  Accessibility,
  BookOpen,
  Bookmark,
  Briefcase,
  Building2,
  BusFront,
  CalendarClock,
  Compass,
  FileText,
  Globe2,
  Handshake,
  Home,
  Leaf,
  LifeBuoy,
  Megaphone,
  MessageCircle,
  MessageSquareHeart,
  Newspaper,
  Search,
  Vote,
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
  /** Needs an account: hidden from visitors. */
  readonly member?: boolean;
}

export type PlaceId = "home" | "procedures" | "city" | "community";

export interface Place {
  readonly id: PlaceId;
  /** Where the place opens. */
  readonly href: string;
  readonly labelKey: MessageKey;
  readonly icon: LucideIcon;
  /** The pages of the place, shown as a row under the top bar. */
  readonly links: readonly ShellNavItem[];
}

/**
 * The whole product in four places, named after what people come to do:
 * home, get something done, know the city, meet the community. Each place
 * lists its pages in one row; the account menu holds everything personal.
 */
export const PLACES: readonly Place[] = [
  { id: "home", href: "/space", labelKey: "tn.place.home", icon: Home, links: [] },
  {
    id: "procedures",
    href: "/services",
    labelKey: "tn.place.procedures",
    icon: Building2,
    links: [
      { href: "/services", labelKey: "tn.nav.services", icon: Building2 },
      { href: "/contact", labelKey: "tn.nav.request", icon: Send },
      { href: "/appointments", labelKey: "tn.appointments.nav", icon: CalendarClock, member: true },
      { href: "/space/feedback", labelKey: "tn.feedback.mine.title", icon: MessageSquareHeart, member: true },
      { href: "/partners", labelKey: "tn.partners.nav", icon: Handshake },
      { href: "/start", labelKey: "tn.start.nav", icon: Compass },
    ],
  },
  {
    id: "city",
    href: "/city-map",
    labelKey: "tn.place.city",
    icon: Globe2,
    links: [
      { href: "/city-map", labelKey: "tn.place.map", icon: Globe2 },
      { href: "/alerts", labelKey: "tn.nav.alerts", icon: Siren },
      { href: "/transports", labelKey: "tn.nav.transports", icon: BusFront },
      { href: "/announcements", labelKey: "tn.nav.announcements", icon: Megaphone },
      { href: "/participate", labelKey: "tn.participate.nav", icon: Vote },
    ],
  },
  {
    id: "community",
    href: "/feed",
    labelKey: "tn.place.community",
    icon: UsersRound,
    links: [
      { href: "/feed", labelKey: "nav.feed", icon: Newspaper },
      { href: "/messages", labelKey: "nav.messages", icon: MessageCircle, badge: "messages", member: true },
      { href: "/groups", labelKey: "nav.groups", icon: UsersRound },
      { href: "/pages", labelKey: "nav.pages", icon: FileText },
      { href: "/saved", labelKey: "nav.saved", icon: Bookmark, member: true },
      { href: "/search", labelKey: "tn.place.people", icon: Search },
    ],
  },
];

/** Help pages, listed in the account menu. */
export const HELP_NAV: readonly ShellNavItem[] = [
  { href: "/assistant", labelKey: "nav.assistant", icon: Sparkles, member: true },
  { href: "/essentials", labelKey: "tn.essentials.title", icon: LifeBuoy },
  { href: "/glossary", labelKey: "tn.glossary.nav", icon: BookOpen },
  { href: "/accessibility", labelKey: "tn.a11y.nav", icon: Accessibility },
  { href: "/eco", labelKey: "tn.eco.nav", icon: Leaf },
];

/** Staff: one door each; their workspaces have their own navigation. */
export const STAFF_NAV: readonly ShellNavItem[] = [
  { href: "/agent", labelKey: "tn.nav.agent", icon: Briefcase, roles: ["AGENT", "ADMIN"] },
  { href: "/admin", labelKey: "nav.admin", icon: ShieldCheck, roles: ["ADMIN"] },
];

export const PROFILE_ICON = UserRound;

export function isActive(pathname: string, href: string): boolean {
  if (href === "/feed") return pathname === "/feed" || pathname.startsWith("/feed/") || pathname.startsWith("/posts");
  if (href === "/admin") return pathname.startsWith("/admin");
  if (href === "/search") return pathname === "/search" || pathname.startsWith("/profile/") || pathname.startsWith("/u/");
  if (href === "/city-map") return pathname === "/city-map" || pathname === "/map";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Pages that belong to a place without being one of its links. */
const EXTRA: Readonly<Record<PlaceId, readonly string[]>> = {
  home: ["/space", "/dashboard"],
  procedures: [],
  city: [],
  community: ["/chat"],
};

/** The place a page belongs to, or null (settings, help pages, staff workspaces). */
export function placeFor(pathname: string): Place | null {
  // The longest match wins, so `/space/feedback` is "procedures", not "home".
  let best: { place: Place; length: number } | null = null;
  for (const place of PLACES) {
    for (const link of place.links) {
      if (isActive(pathname, link.href) && (!best || link.href.length > best.length)) best = { place, length: link.href.length };
    }
    for (const prefix of EXTRA[place.id]) {
      if ((pathname === prefix || pathname.startsWith(`${prefix}/`)) && (!best || prefix.length > best.length)) best = { place, length: prefix.length };
    }
  }
  return best?.place ?? null;
}
