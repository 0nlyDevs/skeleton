import type { Metadata } from "next";

import { PostEditor } from "@/components/posts/post-editor";

export const metadata: Metadata = { title: "Nouvelle publication" };

export default function NewPostPage() {
  return <PostEditor />;
}
