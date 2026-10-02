import type { Metadata } from "next";

import { BlockedList } from "@/components/settings/blocked-list";
import { PrivacyForm } from "@/components/settings/privacy-form";
import { requirePageAuth } from "@/lib/auth/page-guards";
import { getOwnProfile } from "@/modules/users/users.service";

export const metadata: Metadata = { title: "Confidentialité" };

export default async function PrivacyPage() {
  const { user } = await requirePageAuth("/settings/privacy");
  const profile = await getOwnProfile({ user });
  return (
    <div className="flex flex-col gap-4">
      <PrivacyForm showPresence={profile.showPresence} autoLocation={profile.autoLocation} />
      <BlockedList />
    </div>
  );
}
