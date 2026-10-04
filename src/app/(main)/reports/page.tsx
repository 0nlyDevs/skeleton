import type { Metadata } from "next";

import { ReportsBoard } from "@/components/city/reports-board";

export const metadata: Metadata = { title: "Signalements" };

/** F52/F79 — the public board of reported problems, with filters and supports. */
export default async function ReportsPage({ searchParams }: { readonly searchParams: Promise<{ status?: string; sort?: string }> }) {
  const { status, sort } = await searchParams;
  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-5">
      <ReportsBoard initialStatus={status === "DONE" ? "DONE" : "OPEN"} initialSort={sort === "recent" ? "recent" : "supported"} />
    </div>
  );
}
