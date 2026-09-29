"use client";

import { useRealtime } from "@/components/providers/realtime-provider";
import type { Role } from "@/types";

import { SidebarNav } from "./sidebar-nav";

/**
 * The sidebar, with the unread count attached.
 *
 * The count lives in the realtime context; keeping this subscription at the
 * sidebar level rather than in the shell means a notification re-renders the
 * navigation only, not the page beside it.
 */
export function Sidebar({ role, onNavigate }: { readonly role: Role; readonly onNavigate?: () => void }) {
  const { unreadCount } = useRealtime();
  return <SidebarNav role={role} unreadCount={unreadCount} {...(onNavigate ? { onNavigate } : {})} />;
}
