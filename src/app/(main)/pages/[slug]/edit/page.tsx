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
  return (
    <div className="mx-auto w-full max-w-[1200px]">
      <PageEditor initial={page} />
    </div>
  );
}
