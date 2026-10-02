import type { Metadata } from "next";

import { PagesDirectory } from "@/components/pages/pages-directory";
import { getAuthContext } from "@/lib/auth/session";
import { listPages } from "@/modules/pages/pages.service";

export const metadata: Metadata = { title: "Pages" };

export default async function PagesIndex() {
  const context = await getAuthContext();
  const viewer = context?.user ?? null;
  const [discover, mine] = await Promise.all([
    listPages({ scope: "discover", sort: "recent", limit: 12, page: 1 }, viewer),
    viewer ? listPages({ scope: "mine", sort: "recent", limit: 30, page: 1 }, viewer) : Promise.resolve(null),
  ]);
  return (
    <div className="mx-auto w-full max-w-[1000px]">
      <PagesDirectory initialDiscover={discover} mine={mine} signedIn={viewer !== null} />
    </div>
  );
}
