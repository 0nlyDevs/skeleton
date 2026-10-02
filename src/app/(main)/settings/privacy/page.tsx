import type { Metadata } from "next";

import { PrivacyForm } from "@/components/settings/privacy-form";
import { requirePageAuth } from "@/lib/auth/page-guards";
import { getOwnProfile } from "@/modules/users/users.service";

export const metadata: Metadata = { title: "Confidentialité" };

export default async function PrivacyPage() {
  const { user } = await requirePageAuth("/settings/privacy");
  const profile = await getOwnProfile({ user });
  return <PrivacyForm showPresence={profile.showPresence} autoLocation={profile.autoLocation} />;
}
