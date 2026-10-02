import type { Metadata } from "next";

import { PageEditor } from "@/components/pages/page-editor";
import { requirePageAuth } from "@/lib/auth/page-guards";

export const metadata: Metadata = { title: "Nouvelle page" };

export default async function NewPage() {
  await requirePageAuth("/pages/new");
  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <PageEditor initial={null} />
    </div>
  );
}
