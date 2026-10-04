"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import type { FeedItemDto } from "@/modules/posts/posts.dto";

import { MentionInput } from "./mention-input";
import { ACCEPTED_IMAGE_TYPES, useImageUploads } from "./use-image-uploads";

/** Edit text and images of one's own post; shows "edited" once saved. */
export function PostEditDialog({
  post,
  open,
  onOpenChange,
  onSaved,
}: {
  readonly post: FeedItemDto;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSaved: (post: FeedItemDto) => void;
}) {
  const t = useTranslation();
  const [body, setBody] = useState(post.body);
  const [saving, setSaving] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploads = useImageUploads(6, post.media);

  const save = async () => {
    if (uploads.uploading) {
      setHint(t("composer.uploading"));
      return;
    }
    if (body.trim().length === 0 && uploads.readyIds.length === 0) {
      setHint(t("composer.empty_hint"));
      return;
    }
    setSaving(true);
    try {
      const response = await apiFetch<{ data: FeedItemDto }>(`/api/posts/${encodeURIComponent(post.id)}`, {
        method: "PATCH",
        body: { body: body.trim(), mediaIds: uploads.readyIds },
      });
      onSaved(response.data);
      toast.success(t("post.updated"));
      onOpenChange(false);
    } catch (error) {
      setHint(describeApiError(error, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("post.edit_title")}</DialogTitle>
        </DialogHeader>
        <div className="rounded-2xl bg-surface-muted focus-within:ring-2 focus-within:ring-ring/25">
          <MentionInput value={body} onChange={(value) => { setBody(value); setHint(null); }} minRows={4} maxRows={16} maxLength={20_000} autoFocus />
        </div>
        {uploads.images.length > 0 ? (
          <ul className="grid grid-cols-3 gap-2">
            {uploads.images.map((image) => (
              <li key={image.key} className="relative aspect-square overflow-hidden rounded-xl bg-surface-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- preview */}
                <img src={image.previewUrl} alt="" className={cn("h-full w-full object-cover", image.status !== "ready" && "opacity-60")} />
                {image.status === "uploading" ? <Loader2 className="absolute inset-0 m-auto size-5 animate-spin text-white" /> : null}
                <button
                  type="button"
                  onClick={() => uploads.remove(image.key)}
                  aria-label={t("composer.remove_image")}
                  className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/60 text-white"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {hint || uploads.rejection ? <p role="status" className="text-[0.7812rem] font-medium text-error">{hint ?? uploads.rejection}</p> : null}
        <DialogFooter className="items-center sm:justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={() => fileInput.current?.click()}>
            <ImagePlus className="text-success" />
            {t("composer.photo")}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              {t("post.save")}
            </Button>
          </div>
        </DialogFooter>
        <input
          ref={fileInput}
          type="file"
          aria-label={t("tn.a11y.choose_file")}
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          multiple
          hidden
          onChange={(event) => {
            if (event.target.files) uploads.add(event.target.files);
            event.target.value = "";
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
