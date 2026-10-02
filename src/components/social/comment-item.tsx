"use client";

import { Loader2, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useTranslation } from "@/components/providers/i18n-provider";
import { useFormatters } from "@/hooks/use-formatters";
import { UserAvatar } from "@/components/shell/user-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import type { CommentDto } from "@/modules/comments/comments.dto";

import { MentionInput } from "./mention-input";
import { ReportDialog } from "./report-dialog";
import { RichText } from "./rich-text";

/** One comment bubble with reply / edit / delete / report, per rights. */
export function CommentItem({
  comment,
  viewerId,
  canModerate,
  onReply,
  onChanged,
  isReply = false,
}: {
  readonly comment: CommentDto;
  readonly viewerId: string | null;
  readonly canModerate: boolean;
  readonly onReply: (comment: CommentDto) => void;
  readonly onChanged: (comment: CommentDto) => void;
  readonly isReply?: boolean;
}) {
  const t = useTranslation();
  const fmt = useFormatters();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [reporting, setReporting] = useState(false);
  const mine = comment.author?.id === viewerId;

  if (comment.deleted) {
    return (
      <p className={cn("rounded-2xl bg-surface-muted px-3 py-2 text-[13px] italic text-muted-foreground", isReply && "ml-11")}>
        {t("comments.removed")}
      </p>
    );
  }

  const save = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      const response = await apiFetch<{ data: CommentDto }>(`/api/comments/${encodeURIComponent(comment.id)}`, {
        method: "PATCH",
        body: { body: draft.trim() },
      });
      onChanged({ ...response.data, replies: comment.replies });
      setEditing(false);
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/comments/${encodeURIComponent(comment.id)}`, { method: "DELETE" });
      onChanged({ ...comment, deleted: true, body: "", author: null });
      setConfirm(false);
      toast.success(t("comments.deleted"));
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setSaving(false);
    }
  };

  const author = comment.author;
  const profile = author?.username ? `/profile/${encodeURIComponent(author.username)}` : null;

  return (
    <div className={cn("group flex gap-2.5", isReply && "ml-11")}>
      {author ? <UserAvatar userId={author.id} name={author.name} image={author.image} size={isReply ? "xs" : "sm"} /> : null}
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="rounded-2xl bg-surface-muted p-1 ring-2 ring-ring/25">
            <MentionInput value={draft} onChange={setDraft} onSubmit={() => void save()} autoFocus maxLength={2000} />
            <div className="flex justify-end gap-1.5 px-2 pb-1.5">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                {t("common.cancel")}
              </Button>
              <Button size="sm" onClick={() => void save()} disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : null}
                {t("comments.save")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-1">
            <div className="inline-block max-w-full rounded-2xl bg-surface-muted px-3 py-2">
              {author ? (
                profile ? (
                  <Link href={profile} className="block text-[13px] font-semibold hover:underline">
                    {author.name}
                  </Link>
                ) : (
                  <span className="block text-[13px] font-semibold">{author.name}</span>
                )
              ) : null}
              <RichText text={comment.body} mentions={comment.mentions} className="whitespace-pre-line break-words text-[14px] leading-snug [overflow-wrap:anywhere]" />
            </div>
            {viewerId ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={t("common.more")}
                  className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-surface-muted focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                >
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {mine ? (
                    <DropdownMenuItem onSelect={() => { setDraft(comment.body); setEditing(true); }}>
                      {t("comments.edit")}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onSelect={() => setReporting(true)}>{t("comments.report")}</DropdownMenuItem>
                  )}
                  {mine || canModerate ? (
                    <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
                      {t("comments.delete")}
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        )}
        <div className="mt-0.5 flex items-center gap-3 px-3 text-[12px] text-muted-foreground">
          <time dateTime={comment.createdAt} title={fmt.dateTime(comment.createdAt)}>
            {fmt.relative(comment.createdAt)}
          </time>
          {comment.editedAt ? <span>{t("comments.edited")}</span> : null}
          {viewerId ? (
            <button type="button" onClick={() => onReply(comment)} className="font-semibold hover:underline">
              {t("comments.reply")}
            </button>
          ) : null}
        </div>
      </div>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={t("comments.delete_confirm")} busy={saving} onConfirm={() => void remove()} />
      {viewerId && !mine ? <ReportDialog open={reporting} onOpenChange={setReporting} targetType="comment" targetId={comment.id} /> : null}
    </div>
  );
}
