import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginProtectionView } from "@/components/admin/login-protection-view";
import { requireAdmin } from "@/lib/auth/guards";
import { getLoginProtectionOverview } from "@/modules/login-protection/login-protection.stats";

export const metadata: Metadata = { title: "Sécurité des connexions" };
export const dynamic = "force-dynamic";

export default async function AdminSecurityPage() {
  const context = await requireAdmin().catch(() => null);
  if (!context) redirect("/admin");

  return <LoginProtectionView data={await getLoginProtectionOverview()} />;
}
