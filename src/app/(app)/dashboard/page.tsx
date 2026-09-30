import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getAuthContext } from "@/lib/auth/session";
import { getUserOverview } from "@/modules/stats/stats.service";

export const metadata: Metadata = { title: "Tableau de bord" };

/**
 * User dashboard.
 *
 * One server render performs the five aggregate queries in parallel (see
 * `getUserOverview`), so the dashboard costs a single round trip. If the database
 * is unreachable the error boundary renders instead of an empty shell.
 */
export default async function DashboardPage() {
  const context = await getAuthContext();
  if (!context) redirect("/login");

  const overview = await getUserOverview(context.user);

  return (
    <DashboardView
      name={context.user.name}
      posts={overview.posts}
      messages={overview.messages}
      unreadNotifications={overview.unreadNotifications}
      storage={overview.storage}
      // Raw ISO values only. A formatter function cannot cross into a Client
      // Component — React rejects it at render time — so the component formats
      // with the same shared helper instead.
      recentActivity={overview.recentActivity.map((item) => ({
        id: item.id,
        action: item.action,
        targetType: item.targetType,
        createdAt: item.createdAt,
      }))}
    />
  );
}
