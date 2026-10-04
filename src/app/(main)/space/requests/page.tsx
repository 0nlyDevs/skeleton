import type { Metadata } from "next";

import { MyRequestsBoard } from "@/components/city/my-requests-board";
import { requirePageAuth } from "@/lib/auth/page-guards";

export const metadata: Metadata = { title: "Mes démarches" };

/** F79 — the resident's own requests, filterable and sortable. */
export default async function MyRequestsPage() {
  await requirePageAuth("/space/requests");
  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-5">
      <MyRequestsBoard />
    </div>
  );
}
