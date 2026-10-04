import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { getServerDictionary } from "@/lib/i18n/server";
import type { Metadata } from "next";

import { PageEditor } from "@/components/pages/page-editor";
import { requirePageAuth } from "@/lib/auth/page-guards";

export const metadata: Metadata = { title: "Nouvelle page" };

export default async function NewPage() {
  await requirePageAuth("/pages/new");
  const { t } = await getServerDictionary();
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4">
      <Breadcrumbs label={t("tn.breadcrumb.label")} items={[{ label: t("tn.place.community"), href: "/feed" }, { label: t("nav.pages"), href: "/pages" }, { label: t("tn.breadcrumb.new") }]} />
      <PageEditor initial={null} />
    </div>
  );
}
