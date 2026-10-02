import type { Metadata } from "next";
import { Suspense } from "react";

import { MessagesView } from "@/components/messages/messages-view";
import { requirePageAuth } from "@/lib/auth/page-guards";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const { user } = await requirePageAuth("/messages");
  return (
    <Suspense>
      <MessagesView viewer={{ id: user.id, name: user.name, image: user.image }} />
    </Suspense>
  );
}
