"use client";

import { Eye, Flag, Heart, Pencil, QrCode, Share2, Trash2 } from "lucide-react";
import Link from "@/components/ui/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Brand } from "@/components/layout/brand";
import { useTranslation } from "@/components/providers/i18n-provider";
import { UserAvatar } from "@/components/shell/user-avatar";
import { ReportDialog } from "@/components/social/report-dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import type { PageDto } from "@/modules/pages/pages.dto";

import { PageRenderer } from "./page-renderer";

export function PageView({ page: initial, viewerId }: { readonly page: PageDto; readonly viewerId: string | null }) {
  const t = useTranslation();
  const router = useRouter();
  const [page, setPage] = useState(initial);
  const [qr, setQr] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const href = `/p/${encodeURIComponent(page.slug)}`;

  const like = async () => {
    if (!viewerId) {
      router.push(`/login?next=${encodeURIComponent(href)}`);
      return;
    }
    const liked = !page.viewerLiked;
    setPage({ ...page, viewerLiked: liked, likeCount: page.likeCount + (liked ? 1 : -1) });
    try {
      const response = await apiFetch<{ data: { liked: boolean; likeCount: number } }>(`/api/pages/${encodeURIComponent(page.slug)}/like`, { method: liked ? "PUT" : "DELETE" });
      setPage((current) => ({ ...current, viewerLiked: response.data.liked, likeCount: response.data.likeCount }));
    } catch (error) {
      setPage(page);
      toast.error(describeApiError(error, t));
    }
  };

  const share = async () => {
    const url = `${window.location.origin}${href}`;
    try {
      if (navigator.share) await navigator.share({ title: page.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success(t("post.link_copied"));
      }
    } catch {
      // The visitor closed the share sheet.
    }
  };

  const remove = async () => {
    try {
      await apiFetch(`/api/pages/${encodeURIComponent(page.slug)}`, { method: "DELETE" });
      toast.success(t("pages.deleted"));
      router.replace("/pages");
    } catch (error) {
      toast.error(describeApiError(error, t));
    }
  };

  return (
    <div className="min-h-dvh">
      <nav className="sticky top-0 z-30 flex items-center gap-2 border-b border-border/60 bg-background/85 px-4 py-2 backdrop-blur">
        <Brand href="/pages" compact />
        <Link href={page.author.username ? `/profile/${page.author.username}` : "#"} className="ml-1 flex min-w-0 items-center gap-2 text-[0.8125rem]">
          <UserAvatar userId={page.author.id} name={page.author.name} image={page.author.image} size="xs" />
          <span className="truncate font-medium">{page.author.name}</span>
        </Link>
        <span className="ml-auto flex items-center gap-1">
          <span className="hidden items-center gap-1 px-2 text-[0.7812rem] text-muted-foreground sm:inline-flex" title={t("pages.views")}>
            <Eye className="size-4" aria-hidden /> {page.viewCount}
          </span>
          <Button variant="ghost" size="sm" onClick={() => void like()} aria-pressed={page.viewerLiked} aria-label={t("pages.like")}>
            <Heart className={cn(page.viewerLiked && "fill-rose-500 text-rose-500")} />
            {page.likeCount}
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => void share()} aria-label={t("pages.share")}>
                <Share2 />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("pages.share")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => setQr(true)} aria-label={t("pages.qr")}>
                <QrCode />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("pages.qr")}</TooltipContent>
          </Tooltip>
          {page.viewerIsOwner ? (
            <Button asChild size="sm">
              <Link href={`/pages/${encodeURIComponent(page.slug)}/edit`}>
                <Pencil />
                {t("common.edit")}
              </Link>
            </Button>
          ) : viewerId ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setReporting(true)} aria-label={t("post.report")}>
                  <Flag />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("post.report")}</TooltipContent>
            </Tooltip>
          ) : null}
          {page.viewerCanModerate && !page.viewerIsOwner ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setConfirm(true)} aria-label={t("post.remove")}>
                  <Trash2 />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("post.remove")}</TooltipContent>
            </Tooltip>
          ) : null}
        </span>
      </nav>
      {!page.published ? <p className="bg-warning/15 px-4 py-2 text-center text-[0.8125rem] font-medium">{t("pages.draft_banner")}</p> : null}
      <PageRenderer page={page} />
      <footer className="px-4 py-8 text-center text-[0.7812rem] text-muted-foreground">
        {t("pages.made_with")} <Link href="/pages" className="font-semibold hover:underline">Terra Nova</Link>
      </footer>

      <Dialog open={qr} onOpenChange={setQr}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>{t("pages.qr")}</DialogTitle>
            <DialogDescription>{t("pages.qr_hint")}</DialogDescription>
          </DialogHeader>
          {/* eslint-disable-next-line @next/next/no-img-element -- same-origin SVG */}
          {qr ? <img src={`/api/pages/${encodeURIComponent(page.slug)}/qr`} alt={t("pages.qr")} className="mx-auto size-56 rounded-lg bg-white p-2" /> : null}
        </DialogContent>
      </Dialog>
      {reporting ? <ReportDialog open={reporting} onOpenChange={setReporting} targetType="page" targetId={page.id} /> : null}
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={t("pages.remove_confirm")} confirmLabel={t("post.remove")} onConfirm={() => void remove()} />
    </div>
  );
}
