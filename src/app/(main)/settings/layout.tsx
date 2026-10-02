import type { ReactNode } from "react";

import { SettingsTabs } from "@/components/settings/settings-tabs";
import { requirePageAuth } from "@/lib/auth/page-guards";

/** Settings are private: separate from the public profile, never shown to others. */
export default async function SettingsLayout({ children }: { readonly children: ReactNode }) {
  const { user } = await requirePageAuth("/settings/profile");
  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-4">
      <SettingsTabs profileHref={user.username ? `/profile/${encodeURIComponent(user.username)}` : null} />
      {children}
    </div>
  );
}
