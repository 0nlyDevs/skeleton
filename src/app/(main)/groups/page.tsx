import type { Metadata } from "next";

import { GroupsDirectory } from "@/components/groups/groups-directory";
import { getAuthContext } from "@/lib/auth/session";
import { listGroups } from "@/modules/groups/groups.service";

export const metadata: Metadata = { title: "Groupes" };

export default async function GroupsPage() {
  const context = await getAuthContext();
  const mine = context ? await listGroups({ scope: "mine", limit: 1 }, context.user) : [];
  return (
    <div className="mx-auto w-full max-w-[860px]">
      <GroupsDirectory signedIn={context !== null} initialMine={mine} />
    </div>
  );
}
