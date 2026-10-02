import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { UsersTable } from "@/components/admin/users-table";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Utilisateurs" };

/** Admin-only: the API route enforces the same rule independently. */
export default async function AdminUsersPage() {
  const context = await requireAdmin().catch(() => null);
  if (!context) redirect("/admin");

  return <UsersTable currentUserId={context.user.id} />;
}
