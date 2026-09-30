import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PostEditor } from "@/components/posts/post-editor";
import { isStaff } from "@/lib/auth/guards";
import { getAuthContext } from "@/lib/auth/session";
import { getPostForActor } from "@/modules/posts/posts.service";

type PageProps = {
  readonly params: Promise<{ readonly id: string }>;
};

export const metadata: Metadata = { title: "Modifier la publication" };

/**
 * Edit page.
 *
 * Loads through the same service with the caller's session, so the edit form only
 * ever mounts for a post the user is actually allowed to change — the same
 * owner-or-staff rule `updatePostForActor` enforces on submit, so a moderator
 * who can edit through the API is not shown a 404 by the page.
 */
export default async function EditPostPage({ params }: PageProps) {
  const { id } = await params;
  const context = await getAuthContext();
  if (!context) redirect("/login");

  const post = await getPostForActor(id, context.user).catch(() => null);
  if (!post || (post.author.id !== context.user.id && !isStaff(context.user))) notFound();

  return <PostEditor post={post} />;
}
