import type { Metadata } from "next";

import { SearchResults } from "@/components/social/search-results";
import { getAuthContext } from "@/lib/auth/session";
import { searchEverything } from "@/modules/discovery/discovery.service";

export const metadata: Metadata = { title: "Recherche" };

export default async function SearchPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, context] = await Promise.all([searchParams, getAuthContext()]);
  const q = typeof params.q === "string" ? params.q.slice(0, 80) : "";
  const viewer = context?.user ?? null;
  const results = await searchEverything(q, viewer);
  return (
    <div className="mx-auto w-full max-w-[720px]">
      <SearchResults q={q} results={results} viewer={viewer ? { id: viewer.id, name: viewer.name, image: viewer.image } : null} />
    </div>
  );
}
