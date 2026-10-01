"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import type { FeedItemDto, RepostedPostDto } from "@/modules/posts/posts.dto";

import { MentionInput } from "./mention-input";
import { RepostEmbed } from "./repost-embed";

/** Share a post to one's own feed. Captions are optional; one tap shares now. */
export async function sharePost(originalId: string, body = ""): Promise<FeedItemDto> {
  const response = await apiFetch<{ data: FeedItemDto }>("/api/posts", {
    method: "POST",
    body: { repostOfId: originalId, body, published: true },
  });
  return response.data;
}

export function ShareDialog({
  original,
  open,
  onOpenChange,
  onShared,
}: {
  readonly original: RepostedPostDto;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onShared?: (post: FeedItemDto) => void;
}) {
  const t = useTranslation();
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);

  const share = async () => {
    setBusy(true);
    try {
      const post = await sharePost(original.id, caption.trim());
      toast.success(t("share.done"));
      onShared?.(post);
      setCaption("");
      onOpenChange(false);
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("share.title")}</DialogTitle>
        </DialogHeader>
        <div className="rounded-2xl bg-surface-muted focus-within:ring-2 focus-within:ring-ring/25">
          <MentionInput value={caption} onChange={setCaption} placeholder={t("share.caption_placeholder")} minRows={2} maxRows={8} maxLength={20_000} autoFocus />
        </div>
        <div className="max-h-[45dvh] overflow-y-auto">
          <RepostEmbed original={original} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void share()} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : null}
            {t("share.now")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
