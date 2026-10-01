"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Card } from "@/components/ui/card";
import { useSocket } from "@/hooks/use-socket";
import { SOCKET_EVENTS, type PostEngagementPayload } from "@/lib/socket/events";
import type { FeedItemDto } from "@/modules/posts/posts.dto";

import { CommentThread, type ThreadViewer } from "./comment-thread";
import { PostCard } from "./post-card";

/** A post with its full thread inline (the permalink view). */
export function PostPermalink({ post: initial, viewer }: { readonly post: FeedItemDto; readonly viewer: ThreadViewer | null }) {
  const t = useTranslation();
  const router = useRouter();
  const { socket } = useSocket();
  const [post, setPost] = useState(initial);

  // Counters stay live: the thread hook joins `post:<id>`, which also carries
  // engagement frames.
  useEffect(() => {
    if (!socket) return;
    const onEngagement = (payload: PostEngagementPayload) => {
      if (payload.postId !== post.id) return;
      setPost((current) => ({ ...current, commentCount: payload.commentCount, reactionCount: payload.reactionCount, reactions: payload.reactions }));
    };
    socket.on(SOCKET_EVENTS.postEngagement, onEngagement);
    return () => {
      socket.off(SOCKET_EVENTS.postEngagement, onEngagement);
    };
  }, [socket, post.id]);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/feed" className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        {t("feed.back")}
      </Link>
      <PostCard
        post={post}
        viewer={viewer}
        expanded
        onChange={setPost}
        onRemoved={() => router.replace("/feed")}
        onOpenComments={() => document.getElementById("comments")?.scrollIntoView({ behavior: "smooth" })}
      />
      <Card id="comments" className="overflow-hidden">
        <h2 className="border-b border-border/60 px-4 py-3 text-[15px] font-semibold">{t("comments.title")}</h2>
        <CommentThread
          postId={post.id}
          viewer={viewer}
          canComment={post.viewerCanInteract}
          canModerate={post.viewerCanModerate}
          className="max-h-[70dvh]"
        />
      </Card>
    </div>
  );
}
