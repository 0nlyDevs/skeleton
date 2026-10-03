"use client";

import { ExternalLink, Play } from "lucide-react";
import { useEffect, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";
import { storedSrc, storedSrcSet } from "@/lib/media";
import type { PageImageDto } from "@/modules/pages/pages.dto";
import type { PageBlock } from "@/modules/pages/pages.schema";

import { PAGE_FONT_CLASS, themeOf } from "./page-themes";

export interface RenderablePage {
  readonly title: string;
  readonly tagline: string | null;
  readonly theme: string;
  readonly font: string;
  readonly cover: PageImageDto | null;
  readonly blocks: readonly PageBlock[];
  readonly images: Readonly<Record<string, PageImageDto>>;
}

/**
 * Renders a page from typed blocks. All user content goes through React text
 * nodes (escaped); links are http(s) only and open with `noopener`; videos
 * load only after a click, from privacy-enhanced players (eco-design and
 * privacy: nothing third-party loads until the visitor asks for it).
 */
export function PageRenderer({ page, className }: { readonly page: RenderablePage; readonly className?: string }) {
  const theme = themeOf(page.theme);
  return (
    <article className={cn("overflow-hidden", theme.body, PAGE_FONT_CLASS[page.font as keyof typeof PAGE_FONT_CLASS] ?? "font-sans", className)}>
      <header className={cn("relative isolate px-6 py-16 text-center sm:py-24", theme.hero)}>
        {page.cover ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- authorised file route, dimensions known */}
            <img
              src={storedSrc(page.cover.url, 1080)}
              srcSet={storedSrcSet(page.cover.url, [640, 1080])}
              sizes="100vw"
              alt=""
              width={page.cover.width ?? undefined}
              height={page.cover.height ?? undefined}
              className="absolute inset-0 -z-10 size-full object-cover"
              decoding="async"
            />
            <div aria-hidden className="absolute inset-0 -z-10 bg-black/45" />
          </>
        ) : null}
        <h1 className={cn("mx-auto max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-5xl", page.cover && "text-white")}>{page.title}</h1>
        {page.tagline ? <p className={cn("mx-auto mt-4 max-w-2xl text-pretty text-lg opacity-90", page.cover && "text-white")}>{page.tagline}</p> : null}
      </header>
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12">
        {page.blocks.map((block) => (
          <Block key={block.id} block={block} images={page.images} themeName={page.theme} />
        ))}
      </div>
    </article>
  );
}

function PageImage({ image, alt, className }: { image: PageImageDto | undefined; alt: string; className?: string }) {
  if (!image) return <div className={cn("aspect-video rounded-2xl bg-black/10", className)} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- authorised file route, dimensions known
    <img
      src={storedSrc(image.url, 1080)}
      srcSet={storedSrcSet(image.url)}
      sizes="(max-width: 800px) 100vw, 720px"
      alt={alt}
      width={image.width ?? undefined}
      height={image.height ?? undefined}
      loading="lazy"
      decoding="async"
      className={cn("h-auto w-full rounded-2xl object-cover", className)}
    />
  );
}

function Block({ block, images, themeName }: { block: PageBlock; images: Readonly<Record<string, PageImageDto>>; themeName: string }) {
  const theme = themeOf(themeName);
  switch (block.type) {
    case "heading":
      return block.level === 2 ? (
        <h2 className={cn("text-balance text-3xl font-bold tracking-tight", theme.accent)}>{block.text}</h2>
      ) : (
        <h3 className="text-balance text-xl font-semibold">{block.text}</h3>
      );
    case "text":
      return <p className="whitespace-pre-line text-pretty text-[1.0625rem] leading-relaxed [overflow-wrap:anywhere]">{block.text}</p>;
    case "image":
      return (
        <figure className="flex flex-col gap-2">
          <PageImage image={images[block.uploadId]} alt={block.alt || block.caption} />
          {block.caption ? <figcaption className="text-center text-sm opacity-70">{block.caption}</figcaption> : null}
        </figure>
      );
    case "gallery":
      return (
        <div className={cn("grid gap-2", block.uploadIds.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3")}>
          {block.uploadIds.map((id) => (
            <PageImage key={id} image={images[id]} alt="" className="aspect-square" />
          ))}
        </div>
      );
    case "quote":
      return (
        <blockquote className={cn("rounded-2xl px-6 py-5", theme.card)}>
          <p className="text-pretty text-xl font-medium italic leading-relaxed">« {block.text} »</p>
          {block.author ? <footer className="mt-2 text-sm opacity-75">— {block.author}</footer> : null}
        </blockquote>
      );
    case "link":
      return (
        <a
          href={block.url}
          target="_blank"
          rel="noopener noreferrer nofollow ugc"
          className={cn("inline-flex min-h-12 items-center justify-center gap-2 self-center rounded-full px-6 text-[0.9375rem] font-semibold transition-colors", theme.button)}
        >
          {block.label}
          <ExternalLink className="size-4" aria-hidden />
        </a>
      );
    case "video":
      return <VideoBlock provider={block.provider} videoId={block.videoId} />;
    case "divider":
      return <hr className="border-current opacity-15" />;
    case "countdown":
      return <Countdown at={block.at} label={block.label} cardClass={theme.card} accentClass={theme.accent} />;
    case "stats":
      return (
        <dl className={cn("grid gap-3", block.items.length >= 3 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2")}>
          {block.items.map((item, index) => (
            <div key={index} className={cn("rounded-2xl px-4 py-5 text-center", theme.card)}>
              <dt className="order-2 text-sm opacity-75">{item.label}</dt>
              <dd className={cn("text-3xl font-bold tabular-nums", theme.accent)}>{item.value}</dd>
            </div>
          ))}
        </dl>
      );
    case "timeline":
      return (
        <ol className="relative flex flex-col gap-6 border-l-2 border-current/20 pl-6">
          {block.items.map((item, index) => (
            <li key={index} className="relative">
              <span aria-hidden className={cn("absolute -left-[31px] top-1.5 size-3 rounded-full bg-current", theme.accent)} />
              <p className={cn("text-sm font-semibold uppercase tracking-wide", theme.accent)}>{item.date}</p>
              <p className="text-lg font-semibold">{item.title}</p>
              {item.text ? <p className="mt-1 whitespace-pre-line opacity-80">{item.text}</p> : null}
            </li>
          ))}
        </ol>
      );
  }
}

function VideoBlock({ provider, videoId }: { provider: "youtube" | "vimeo"; videoId: string }) {
  const t = useTranslation();
  const [playing, setPlaying] = useState(false);
  const src =
    provider === "youtube"
      ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`
      : `https://player.vimeo.com/video/${encodeURIComponent(videoId)}?autoplay=1&dnt=1`;
  return (
    <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
      {playing ? (
        <iframe
          src={src}
          title={t("pages.video")}
          className="absolute inset-0 size-full"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white"
          aria-label={t("pages.play_video")}
        >
          <span className="grid size-16 place-items-center rounded-full bg-white/15 backdrop-blur transition-transform hover:scale-105">
            <Play className="size-7 fill-current" />
          </span>
          <span className="text-xs opacity-75">{t("pages.video_consent", { provider: provider === "youtube" ? "YouTube" : "Vimeo" })}</span>
        </button>
      )}
    </div>
  );
}

function Countdown({ at, label, cardClass, accentClass }: { at: string; label: string; cardClass: string; accentClass: string }) {
  const t = useTranslation();
  const target = Date.parse(at);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);
  const left = now === null ? null : Math.max(0, target - now);
  const parts =
    left === null
      ? null
      : [
          [Math.floor(left / 86_400_000), t("pages.countdown.days")],
          [Math.floor(left / 3_600_000) % 24, t("pages.countdown.hours")],
          [Math.floor(left / 60_000) % 60, t("pages.countdown.minutes")],
          [Math.floor(left / 1_000) % 60, t("pages.countdown.seconds")],
        ];
  return (
    <section className={cn("rounded-2xl px-6 py-6 text-center", cardClass)} aria-label={label || t("pages.block.countdown")}>
      {label ? <p className="mb-3 font-semibold">{label}</p> : null}
      {left === 0 ? (
        <p className={cn("text-2xl font-bold", accentClass)}>{t("pages.countdown.done")}</p>
      ) : (
        <div className="flex justify-center gap-3" role="timer">
          {(parts ?? [[0, ""], [0, ""], [0, ""], [0, ""]]).map(([value, unit], index) => (
            <div key={index} className="min-w-16">
              <p className={cn("text-3xl font-bold tabular-nums", accentClass)}>{parts ? String(value).padStart(2, "0") : "--"}</p>
              <p className="text-xs opacity-70">{unit}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
