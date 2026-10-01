import type { Metadata } from "next";

import { UserSearch } from "@/components/social/user-search";

export const metadata: Metadata = { title: "Find people" };

export default function SearchPage() {
  return <UserSearch />;
}
