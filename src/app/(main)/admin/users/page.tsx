import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminUsers } from "@/components/admin/admin-users";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Utilisateurs" };

/** Admin-only: the API route enforces the same rule independently. */
export default async function AdminUsersPage() {
  const context = await requireAdmin().catch(() => null);
  if (!context) redirect("/admin");

  return <AdminUsers currentUserId={context.user.id} />;
}
