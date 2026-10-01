"use client";

import { ArrowLeft, Flag, Pencil, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { initials } from "@/lib/utils";
import type { AuthUser } from "@/types";
import type { PostDto } from "@/modules/posts/posts.dto";

/**
 * Post detail.
 *
 * Actions are computed from props (`isOwner` comes from the server render), but
 * the server re-checks every one of them — hiding a button is UX, not security.
 *
 * Delete asks for confirmation in a dialog rather than a native `confirm()`: it
 * keeps the visual language consistent, and the destructive action is named in the
 * button ("delete", not "OK") so the choice is legible.
 */
export function PostDetail({
  post,
  viewer,
  canModerate,
}: {
  readonly post: PostDto;
  readonly viewer: AuthUser | null;
  readonly canModerate: boolean;
}) {
  const t = useTranslation();
  const router = useRouter();

  const isOwner = viewer?.id === post.author.id;

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reporting, setReporting] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [tagging, setTagging] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiFetch(`/api/posts/${post.id}`, { method: "DELETE" });
      toast.success(t("posts.deleted"));
      router.replace("/posts");
      router.refresh();
    } catch {
      setDeleting(false);
      setDeleteOpen(false);
      toast.error(t("feedback.error.body"));
    }
  };

  const handleReport = async () => {
    if (reporting || reportReason.trim().length < 5) return;
    setReporting(true);
    try {
      await apiFetch("/api/reports", {
        method: "POST",
        body: { targetType: "post", targetId: post.id, reason: reportReason.trim() },
      });
      toast.success(t("posts.report.sent"));
      setReportOpen(false);
      setReportReason("");
    } catch {
      toast.error(t("feedback.error.body"));
    } finally {
      setReporting(false);
    }
  };

  const handleSummarize = async () => {
    setSummarizing(true);
    try {
      const response = await apiFetch<{ data: { reply: string } }>("/api/ai/summarize", {
        method: "POST",
        body: { postId: post.id },
      });
      setSummary(response.data.reply);
    } catch {
      toast.error(t("ai.disabled"));
    } finally {
      setSummarizing(false);
    }
  };

  const handleSuggestTags = async () => {
    setTagging(true);
    try {
      const response = await apiFetch<{ data: { tags: string[] } }>("/api/ai/tags", {
        method: "POST",
        body: { postId: post.id },
      });
      setSuggestedTags(response.data.tags);
    } catch {
      toast.error(t("ai.disabled"));
    } finally {
      setTagging(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/posts">
            <ArrowLeft />
            {t("common.back")}
          </Link>
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          {isOwner ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={`/posts/${post.id}/edit`}>
                <Pencil />
                {t("common.edit")}
              </Link>
            </Button>
          ) : null}

          {(isOwner || canModerate) && !post.deletedAt ? (
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 />
              {t("common.delete")}
            </Button>
          ) : null}

          {!isOwner && viewer ? (
            <Button variant="ghost" size="sm" onClick={() => setReportOpen(true)}>
              <Flag />
              {t("posts.report")}
            </Button>
          ) : null}
        </div>
      </header>

      <article className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {!post.published ? <Badge variant="warning">{t("posts.status.draft")}</Badge> : null}
            {post.tags.map((tag) => (
              <Badge key={tag} variant="neutral">
                {tag}
              </Badge>
            ))}
            {suggestedTags
              .filter((tag) => !post.tags.includes(tag))
              .map((tag) => (
                <Badge key={tag} variant="primary">
                  {tag}
                </Badge>
              ))}
          </div>

          <h1 className="text-balance text-[30px] font-semibold leading-tight tracking-[-0.02em]">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center gap-2.5 text-[13px] text-muted-foreground">
            <Avatar className="size-7">
              {post.author.image ? <AvatarImage src={post.author.image} alt="" /> : null}
              <AvatarFallback className="text-[11px]">{initials(post.author.name)}</AvatarFallback>
            </Avatar>
            <span className="font-medium text-foreground/80">{post.author.name}</span>
            <span aria-hidden>·</span>
            <time dateTime={post.createdAt}>{formatDateTime(post.createdAt)}</time>
          </div>
        </div>

        <Card className="p-6">
          <div className="flex flex-col gap-4 text-[15px] leading-relaxed">
            {post.body.split(/\n{2,}/).map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </Card>

        <Card className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Sparkles className="size-4" />
            </span>
            <span className="text-[13.5px] font-medium">{t("posts.ai.summarize")}</span>
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" size="sm" disabled={summarizing} onClick={() => void handleSummarize()}>
                {summarizing ? t("posts.ai.running") : t("posts.ai.summarize")}
              </Button>
              <Button variant="ghost" size="sm" disabled={tagging} onClick={() => void handleSuggestTags()}>
                {tagging ? t("posts.ai.running") : t("posts.ai.tags")}
              </Button>
            </div>
          </div>

          {summary ? (
            <p className="rounded-xl bg-surface-muted px-4 py-3 text-[13.5px] leading-relaxed text-muted-foreground">
              {summary}
            </p>
          ) : null}
        </Card>
      </article>

      {/* --- Delete confirmation --- */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("posts.delete.title")}</DialogTitle>
            <DialogDescription>{t("posts.delete.body")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? t("common.loading") : t("common.yes_delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Report --- */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("posts.report.title")}</DialogTitle>
            <DialogDescription>{t("posts.report.reason")}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={reportReason}
            onChange={(event) => setReportReason(event.target.value)}
            rows={4}
            minLength={5}
            maxLength={1000}
            required
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReportOpen(false)} disabled={reporting}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => void handleReport()}
              disabled={reporting || reportReason.trim().length < 5}
            >
              {reporting ? t("common.loading") : t("posts.report.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
