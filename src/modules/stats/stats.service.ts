/**
 * Dashboard data.
 *
 * The user overview is cheap and computed per request. The admin overview is the
 * expensive one — six aggregations over growing tables — so it is served through
 * the cache with a short TTL. The trade-off is explicit: an admin dashboard that
 * is up to a minute stale is fine; one that makes every load do six table scans
 * is not.
 */

import { cacheKey, getOrSet } from "@/lib/cache";
import type { AuthUser } from "@/types";

import {
  adminPostCounts,
  adminUserCounts,
  countAuditSince,
  countMessagesForUser,
  countOpenReports,
  countPostsForUser,
  countUnreadNotificationsForUser,
  publicCounts,
  recentAuditForUser,
  recentOpenReports,
  signupsPerDay,
  storageForUser,
  totalStorageBytes,
} from "./stats.repository";

const ADMIN_CACHE_TTL_MS = 30_000;
const PUBLIC_CACHE_TTL_MS = 60_000;

export interface PublicCounts {
  readonly members: number;
  readonly publishedPosts: number;
  readonly auditedActions: number;
}

/**
 * Landing-page counters.
 *
 * Cached for a minute and safe to fail: the caller renders the page without the
 * numbers rather than surfacing an error, because an unreachable database must
 * not take down the front door.
 */
export async function getPublicCounts(): Promise<PublicCounts> {
  return getOrSet(cacheKey("stats:public"), PUBLIC_CACHE_TTL_MS, publicCounts);
}
const RECENT_ACTIVITY_LIMIT = 8;
const RECENT_REPORTS_LIMIT = 5;

export interface ActivityItem {
  readonly id: string;
  readonly action: string;
  readonly targetType: string | null;
  readonly targetId: string | null;
  readonly createdAt: string;
}

export interface UserOverview {
  readonly posts: { total: number; published: number; drafts: number };
  readonly messages: number;
  readonly unreadNotifications: number;
  readonly storage: { files: number; bytes: number };
  readonly recentActivity: ActivityItem[];
}

export async function getUserOverview(user: AuthUser): Promise<UserOverview> {
  const [posts, messages, unreadNotifications, storage, activity] = await Promise.all([
    countPostsForUser(user.id),
    countMessagesForUser(user.id),
    countUnreadNotificationsForUser(user.id),
    storageForUser(user.id),
    recentAuditForUser(user.id, RECENT_ACTIVITY_LIMIT),
  ]);

  return {
    posts,
    messages,
    unreadNotifications,
    storage,
    recentActivity: activity.map((row) => ({
      id: row.id,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export interface AdminOverview {
  readonly users: {
    total: number;
    banned: number;
    verified: number;
    byRole: Record<string, number>;
  };
  readonly posts: { total: number; published: number; deleted: number };
  readonly reports: { open: number; recent: readonly {
    id: string;
    targetType: string;
    targetId: string;
    reason: string;
    createdAt: string;
    reporterName: string | null;
  }[] };
  readonly audit: { last24h: number };
  readonly storage: { bytes: number };
  readonly signups: readonly { day: string; count: number }[];
}

export async function getAdminOverview(): Promise<AdminOverview> {
  return getOrSet(cacheKey("stats:admin:overview"), ADMIN_CACHE_TTL_MS, async () => {
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [users, posts, openReports, last24h, bytes, signups, recent] = await Promise.all([
      adminUserCounts(),
      adminPostCounts(),
      countOpenReports(),
      countAuditSince(dayAgo),
      totalStorageBytes(),
      signupsPerDay(since),
      recentOpenReports(RECENT_REPORTS_LIMIT),
    ]);

    return {
      users,
      posts,
      reports: {
        open: openReports,
        recent: recent.map((row) => ({
          id: row.id,
          targetType: row.targetType,
          targetId: row.targetId,
          reason: row.reason,
          createdAt: row.createdAt.toISOString(),
          reporterName: row.reporter?.name ?? null,
        })),
      },
      audit: { last24h },
      storage: { bytes },
      signups,
    };
  });
}
