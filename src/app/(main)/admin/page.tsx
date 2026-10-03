import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminOverview } from "@/components/admin/admin-overview";
import { requireStaff } from "@/lib/auth/guards";
import { getAdminOverview } from "@/modules/stats/stats.service";

export const metadata: Metadata = { title: "Administration" };

/**
 * Admin overview.
 *
 * The guard is `requireStaff` — moderators see the queue-focused view and admins
 * see everything. The same rule is enforced on the API routes backing every card;
 * this page only decides whether the shell renders.
 */
export default async function AdminPage() {
  const context = await requireStaff().catch(() => null);
  if (!context) redirect("/espace");

  const data = await getAdminOverview();

  return <AdminOverview data={data} />;
}
