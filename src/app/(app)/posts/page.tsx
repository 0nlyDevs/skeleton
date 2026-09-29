import type { Metadata } from "next";

import { PostList } from "@/components/posts/post-list";
import { isAdmin, isStaff } from "@/lib/auth/guards";
import { getAuthContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Publications" };

/**
 * Posts list.
 *
 * The moderation flag only widens what staff can *see*; it is passed as a prop for
 * the UI and every row still comes from the API, which applies the same rule
 * independently.
 */
export default async function PostsPage() {
  const context = await getAuthContext();

  return (
    <PostList
      canModerate={context ? isStaff(context.user) || isAdmin(context.user) : false}
    />
  );
}
