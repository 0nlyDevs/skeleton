import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";

import { PageView } from "@/components/pages/page-view";
import { getAuthContext } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { resolveClientIp } from "@/lib/http/client-ip";
import { getPage } from "@/modules/pages/pages.service";

type Props = { readonly params: Promise<{ readonly slug: string }> };

/** One read per request, shared by the metadata and the page (one counted view). */
const load = cache(async (slug: string) => {
  const [context, headerList] = await Promise.all([getAuthContext(), headers()]);
  const viewer = context?.user ?? null;
  const ip = resolveClientIp(headerList, env.trustProxy);
  const page = await getPage(slug.toLowerCase(), viewer, viewer?.id ?? ip).catch(() => null);
  return { page, viewer };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { page } = await load(slug);
  if (!page) return { title: "Page introuvable" };
  return {
    title: page.title,
    description: page.tagline ?? undefined,
    robots: page.visibility === "UNLISTED" || !page.published ? { index: false, follow: false } : undefined,
    openGraph: { title: page.title, description: page.tagline ?? undefined, images: page.cover ? [page.cover.url] : undefined },
  };
}

/** A user page, full-bleed, outside the app shell: it is meant to be shared. */
export default async function PublicPage({ params }: Props) {
  const { slug } = await params;
  const { page, viewer } = await load(slug);
  if (!page) notFound();
  return <PageView page={page} viewerId={viewer?.id ?? null} />;
}
