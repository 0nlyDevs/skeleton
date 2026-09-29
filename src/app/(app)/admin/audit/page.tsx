import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuditView } from "@/components/admin/audit-view";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Journal d'audit" };

export default async function AuditPage() {
  const context = await requireAdmin().catch(() => null);
  if (!context) redirect("/admin");

  return <AuditView />;
}
