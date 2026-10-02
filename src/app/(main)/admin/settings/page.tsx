import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminSettingsView } from "@/components/admin/admin-settings";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Indicateurs" };

export default async function AdminSettingsPage() {
  const context = await requireAdmin().catch(() => null);
  if (!context) redirect("/admin");

  const flags = await prisma.featureFlag.findMany({
    orderBy: { key: "asc" },
  });

  return (
    <AdminSettingsView
      flags={flags.map((flag) => ({
        key: flag.key,
        description: flag.description,
        enabled: flag.enabled,
        updatedAt: flag.updatedAt.toISOString(),
      }))}
    />
  );
}
