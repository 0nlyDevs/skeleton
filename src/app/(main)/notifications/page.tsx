import type { Metadata } from "next";

import { NotificationsView } from "@/components/notifications/notifications-view";
import { requirePageAuth } from "@/lib/auth/page-guards";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  await requirePageAuth("/notifications");
  return (
    <div className="mx-auto w-full max-w-[760px]">
      <NotificationsView />
    </div>
  );
}
