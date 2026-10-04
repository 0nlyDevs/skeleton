import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { getServerDictionary } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageEditor } from "@/components/pages/page-editor";
import { requirePageAuth } from "@/lib/auth/page-guards";
import { getPageForEditing } from "@/modules/pages/pages.service";

export const metadata: Metadata = { title: "Modifier la page" };

type Props = { readonly params: Promise<{ readonly slug: string }> };

export default async function EditPage({ params }: Props) {
  const { slug } = await params;
  const { user } = await requirePageAuth(`/pages/${slug}/edit`);
  const page = await getPageForEditing(slug.toLowerCase(), user).catch(() => null);
  if (!page) notFound();
  const { t } = await getServerDictionary();
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4">
      <Breadcrumbs label={t("tn.breadcrumb.label")} items={[{ label: t("tn.place.community"), href: "/feed" }, { label: t("nav.pages"), href: "/pages" }, { label: t("tn.breadcrumb.edit") }]} />
      <PageEditor initial={page} />
    </div>
  );
}
