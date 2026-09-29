import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PostDetail } from "@/components/posts/post-detail";
import { isStaff } from "@/lib/auth/guards";
import { getAuthContext } from "@/lib/auth/session";
import { getPostForActor } from "@/modules/posts/posts.service";

type PageProps = {
  readonly params: Promise<{ readonly id: string }>;
};

export const metadata: Metadata = { title: "Publication" };

/**
 * Post detail.
 *
 * The fetch goes through the posts service with the *server* session, so the
 * visibility rules (drafts private, soft-deleted hidden) are the same ones the API
 * applies. A post the viewer cannot see is a 404 page, not an error — identical to
 * what the JSON endpoint returns for the same id.
 */
export default async function PostPage({ params }: PageProps) {
  const { id } = await params;
  const context = await getAuthContext();
  if (!context) redirect("/login");

  const post = await getPostForActor(id, context.user).catch(() => null);
  if (!post) notFound();

  return (
    <PostDetail
      post={post}
      viewer={context.user}
      canModerate={isStaff(context.user)}
    />
  );
}
