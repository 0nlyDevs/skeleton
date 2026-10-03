import type { Metadata } from "next";

import { ModerationQueue } from "@/components/admin/moderation-queue";
import { requireStaff } from "@/lib/auth/guards";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Modération" };

export default async function ModerationPage() {
  const context = await requireStaff().catch(() => null);
  if (!context) redirect("/espace");

  return <ModerationQueue />;
}
