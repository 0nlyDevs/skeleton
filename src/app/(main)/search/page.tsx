import type { Metadata } from "next";

import { SearchResults } from "@/components/social/search-results";
import { getAuthContext } from "@/lib/auth/session";
import { searchEverything } from "@/modules/discovery/discovery.service";
import { PEOPLE_ROLES } from "@/modules/follows/follows.schema";

export const metadata: Metadata = { title: "Recherche" };

export default async function SearchPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, context] = await Promise.all([searchParams, getAuthContext()]);
  const q = typeof params.q === "string" ? params.q.slice(0, 80) : "";
  const viewer = context?.user ?? null;
  const role = viewer ? PEOPLE_ROLES.find((value) => value === params.role) : undefined;
  const everyone = viewer !== null && params.all === "1" && !role;
  const page = Math.max(1, Number.parseInt(typeof params.page === "string" ? params.page : "1", 10) || 1);
  const results = await searchEverything(q, viewer, { role, everyone, page });
  return (
    <div className="mx-auto w-full max-w-[720px]">
      <SearchResults q={q} role={role ?? null} everyone={everyone} results={results} viewer={viewer ? { id: viewer.id, name: viewer.name, image: viewer.image } : null} />
    </div>
  );
}
