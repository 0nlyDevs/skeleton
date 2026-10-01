"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { PostMediaDto } from "@/modules/posts/posts.dto";

/**
 * Up to six images in a stable grid (dimensions reserved, so nothing jumps
 * while they load), opening a keyboard-navigable lightbox.
 */
export function MediaGrid({ media }: { readonly media: readonly PostMediaDto[] }) {
  const t = useTranslation();
  const [open, setOpen] = useState<number | null>(null);
  if (media.length === 0) return null;

  const shown = media.slice(0, 4);
  const extra = media.length - shown.length;
  const single = media.length === 1 ? media[0] : null;

  return (
    <>
      {single ? (
        <button
          type="button"
          onClick={() => setOpen(0)}
          aria-label={t("post.open_image")}
          className="block w-full overflow-hidden rounded-xl bg-surface-muted"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- authorised, already-optimised WebP */}
          <img
            src={single.url}
            alt={t("post.image_alt", { n: 1 })}
            loading="lazy"
            decoding="async"
            width={single.width ?? undefined}
            height={single.height ?? undefined}
            style={{ aspectRatio: single.width && single.height ? `${single.width} / ${single.height}` : "4 / 3" }}
            className="max-h-[560px] w-full object-cover"
          />
        </button>
      ) : (
        <div className={cn("grid gap-1.5 overflow-hidden rounded-xl", shown.length === 2 ? "grid-cols-2" : "grid-cols-2 grid-rows-2")}>
          {shown.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setOpen(index)}
              aria-label={t("post.open_image")}
              className={cn(
                "relative block overflow-hidden bg-surface-muted",
                shown.length === 3 && index === 0 && "row-span-2",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- authorised, already-optimised WebP */}
              <img
                src={item.url}
                alt={t("post.image_alt", { n: index + 1 })}
                loading="lazy"
                decoding="async"
                className={cn("h-full w-full object-cover", shown.length === 2 ? "aspect-square" : "aspect-[4/3]")}
              />
              {index === shown.length - 1 && extra > 0 ? (
                <span className="absolute inset-0 grid place-items-center bg-black/50 text-[22px] font-semibold text-white">
                  +{extra}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}
      <Lightbox media={media} index={open} onIndex={setOpen} />
    </>
  );
}

function Lightbox({
  media,
  index,
  onIndex,
}: {
  readonly media: readonly PostMediaDto[];
  readonly index: number | null;
  readonly onIndex: (index: number | null) => void;
}) {
  const t = useTranslation();
  const step = useCallback(
    (delta: number) => {
      if (index === null) return;
      onIndex((index + delta + media.length) % media.length);
    },
    [index, media.length, onIndex],
  );

  useEffect(() => {
    if (index === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, step]);

  const current = index !== null ? media[index] : null;

  return (
    <Dialog open={index !== null} onOpenChange={(open) => !open && onIndex(null)}>
      <DialogContent className="max-w-[min(96vw,1100px)] border-0 bg-black/95 p-0 sm:rounded-2xl [&>button]:hidden">
        <DialogTitle className="sr-only">{t("post.open_image")}</DialogTitle>
        {current ? (
          <div className="relative flex max-h-[90dvh] items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- authorised, already-optimised WebP */}
            <img src={current.url} alt={t("post.image_alt", { n: (index ?? 0) + 1 })} className="max-h-[90dvh] w-auto object-contain" />
            <button
              type="button"
              onClick={() => onIndex(null)}
              aria-label={t("common.close")}
              className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
            >
              <X className="size-5" />
            </button>
            {media.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="Previous"
                  className="absolute left-3 grid size-10 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="Next"
                  className="absolute right-3 grid size-10 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
                >
                  <ChevronRight className="size-5" />
                </button>
                <span className="absolute bottom-3 rounded-full bg-black/60 px-3 py-1 text-[12px] text-white">
                  {(index ?? 0) + 1} / {media.length}
                </span>
              </>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
