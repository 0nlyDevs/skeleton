import type { ReactNode } from "react";

import { AgentNav } from "@/components/agent/agent-nav";
import { isAdmin, isStaff } from "@/lib/auth/guards";
import { getAuthContext } from "@/lib/auth/session";
import type { MessageKey } from "@/lib/i18n";
import { getServerDictionary } from "@/lib/i18n/server";
import { awaitingPickup } from "@/modules/city-requests/city-requests.service";

/**
 * D19 — the agent workspace, separate from the citizen space. The header only
 * renders for staff; each page checks the role itself (layouts are not a
 * security boundary in the App Router) and shows a 403 to anyone else.
 */
export default async function AgentLayout({ children }: { readonly children: ReactNode }) {
  const context = await getAuthContext();
  const user = context?.user;
  if (!user || !isStaff(user)) return <>{children}</>;
  const [{ t }, pickup] = await Promise.all([getServerDictionary(), awaitingPickup(user)]);

  return (
    <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-5">
      <AgentNav isAdmin={isAdmin(user)} roleLabel={t(`role.${user.role.toLowerCase()}` as MessageKey)} awaitingPickup={pickup.count} />
      {children}
    </div>
  );
}
