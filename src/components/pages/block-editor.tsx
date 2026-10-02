"use client";

import { ArrowDown, ArrowUp, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { IMAGE_INPUT_ACCEPT, uploadImage } from "@/components/social/use-image-uploads";
import { UnsupportedImageError } from "@/lib/images/prepare-image";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { describeApiError } from "@/lib/api/error-message";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { PageImageDto } from "@/modules/pages/pages.dto";
import { parseVideoUrl, type PageBlock } from "@/modules/pages/pages.schema";

export type ImageMap = Record<string, PageImageDto>;

/** Upload one image privately; it becomes visible once the page is published. */
export function useImageUploader(onUploaded: (image: PageImageDto) => void) {
  const t = useTranslation();
  const [busy, setBusy] = useState(false);
  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error(t("composer.image_type"));
      return;
    }
    setBusy(true);
    try {
      const uploaded = await uploadImage(file);
      onUploaded({ id: uploaded.id, url: uploaded.url, width: null, height: null });
    } catch (error) {
      toast.error(error instanceof UnsupportedImageError ? t("composer.image_type") : describeApiError(error, t));
    } finally {
      setBusy(false);
    }
  };
  return { busy, upload };
}

export function ImagePicker({ image, onPick, onClear, label }: { image: PageImageDto | null; onPick: (image: PageImageDto) => void; onClear?: () => void; label: string }) {
  const t = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const { busy, upload } = useImageUploader(onPick);
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-border bg-surface-muted text-muted-foreground hover:border-primary"
        aria-label={label}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- own upload preview */}
        {image ? <img src={image.url} alt="" className="absolute inset-0 size-full object-cover" /> : <ImagePlus className="size-5" />}
        {busy ? <Loader2 className="absolute size-5 animate-spin text-white drop-shadow" /> : null}
      </button>
      <div className="flex flex-col gap-1 text-[13px]">
        <button type="button" className="text-left font-semibold text-primary hover:underline" onClick={() => input.current?.click()}>
          {image ? t("pages.editor.replace_image") : label}
        </button>
        {image && onClear ? (
          <button type="button" className="text-left text-muted-foreground hover:underline" onClick={onClear}>
            {t("pages.editor.remove_image")}
          </button>
        ) : null}
      </div>
      <input
        ref={input}
        type="file"
        accept={IMAGE_INPUT_ACCEPT}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[13px]">
      <span className="font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/** Edits one block. Lengths mirror the server schema; the server stays the authority. */
export function BlockEditor({
  block,
  images,
  onChange,
  onImage,
  onMove,
  onRemove,
  first,
  last,
}: {
  block: PageBlock;
  images: ImageMap;
  onChange: (block: PageBlock) => void;
  onImage: (image: PageImageDto) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  first: boolean;
  last: boolean;
}) {
  const t = useTranslation();
  const [videoUrl, setVideoUrl] = useState(block.type === "video" ? (block.provider === "youtube" ? `https://youtu.be/${block.videoId}` : `https://vimeo.com/${block.videoId}`) : "");

  const body = (() => {
    switch (block.type) {
      case "heading":
        return (
          <div className="flex gap-2">
            <Input value={block.text} maxLength={140} onChange={(event) => onChange({ ...block, text: event.target.value })} placeholder={t("pages.block.heading")} />
            <select
              value={block.level}
              onChange={(event) => onChange({ ...block, level: Number(event.target.value) === 3 ? 3 : 2 })}
              className="h-10 rounded-lg border border-border bg-surface px-2 text-[13px]"
              aria-label={t("pages.editor.heading_size")}
            >
              <option value={2}>{t("pages.editor.heading_large")}</option>
              <option value={3}>{t("pages.editor.heading_small")}</option>
            </select>
          </div>
        );
      case "text":
        return <Textarea value={block.text} maxLength={5000} rows={4} onChange={(event) => onChange({ ...block, text: event.target.value })} placeholder={t("pages.editor.text_placeholder")} />;
      case "image":
        return (
          <div className="flex flex-col gap-2">
            <ImagePicker
              image={images[block.uploadId] ?? null}
              label={t("pages.editor.pick_image")}
              onPick={(image) => {
                onImage(image);
                onChange({ ...block, uploadId: image.id });
              }}
            />
            <Field label={t("pages.editor.caption")}>
              <Input value={block.caption} maxLength={200} onChange={(event) => onChange({ ...block, caption: event.target.value })} />
            </Field>
            <Field label={t("pages.editor.alt")}>
              <Input value={block.alt} maxLength={200} onChange={(event) => onChange({ ...block, alt: event.target.value })} placeholder={t("pages.editor.alt_hint")} />
            </Field>
          </div>
        );
      case "gallery":
        return (
          <div className="flex flex-wrap gap-2">
            {block.uploadIds.map((uploadId) => (
              <div key={uploadId} className="relative size-20 overflow-hidden rounded-xl bg-surface-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- own upload preview */}
                {images[uploadId] ? <img src={images[uploadId].url} alt="" className="size-full object-cover" /> : null}
                <button
                  type="button"
                  aria-label={t("pages.editor.remove_image")}
                  onClick={() => onChange({ ...block, uploadIds: block.uploadIds.filter((entry) => entry !== uploadId) })}
                  className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/60 text-white"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            {block.uploadIds.length < 6 ? (
              <ImagePicker
                image={null}
                label={t("pages.editor.add_image")}
                onPick={(image) => {
                  onImage(image);
                  onChange({ ...block, uploadIds: [...block.uploadIds, image.id] });
                }}
              />
            ) : null}
          </div>
        );
      case "quote":
        return (
          <div className="flex flex-col gap-2">
            <Textarea value={block.text} maxLength={500} rows={2} onChange={(event) => onChange({ ...block, text: event.target.value })} placeholder={t("pages.block.quote")} />
            <Input value={block.author} maxLength={80} onChange={(event) => onChange({ ...block, author: event.target.value })} placeholder={t("pages.editor.quote_author")} />
          </div>
        );
      case "link":
        return (
          <div className="grid gap-2 sm:grid-cols-2">
            <Input value={block.label} maxLength={60} onChange={(event) => onChange({ ...block, label: event.target.value })} placeholder={t("pages.editor.link_label")} />
            <Input value={block.url} type="url" maxLength={500} onChange={(event) => onChange({ ...block, url: event.target.value })} placeholder="https://" />
          </div>
        );
      case "video":
        return (
          <Field label={t("pages.editor.video_url")}>
            <Input
              value={videoUrl}
              placeholder="https://youtu.be/…"
              onChange={(event) => {
                setVideoUrl(event.target.value);
                const parsed = parseVideoUrl(event.target.value);
                if (parsed) onChange({ ...block, ...parsed });
              }}
            />
            {videoUrl && !parseVideoUrl(videoUrl) ? <span className="text-[12px] text-error">{t("pages.editor.video_invalid")}</span> : null}
          </Field>
        );
      case "divider":
        return <p className="text-[13px] text-muted-foreground">{t("pages.editor.divider_hint")}</p>;
      case "countdown":
        return (
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              type="datetime-local"
              value={toLocalInput(block.at)}
              onChange={(event) => {
                const date = new Date(event.target.value);
                if (!Number.isNaN(date.getTime())) onChange({ ...block, at: date.toISOString() });
              }}
              aria-label={t("pages.editor.countdown_date")}
            />
            <Input value={block.label} maxLength={80} onChange={(event) => onChange({ ...block, label: event.target.value })} placeholder={t("pages.editor.countdown_label")} />
          </div>
        );
      case "stats":
        return (
          <ListEditor
            items={block.items}
            max={4}
            empty={{ value: "", label: "" }}
            onChange={(items) => onChange({ ...block, items })}
            render={(item, set) => (
              <div className="grid flex-1 grid-cols-[6rem_1fr] gap-2">
                <Input value={item.value} maxLength={20} onChange={(event) => set({ ...item, value: event.target.value })} placeholder="42" aria-label={t("pages.editor.stat_value")} />
                <Input value={item.label} maxLength={60} onChange={(event) => set({ ...item, label: event.target.value })} placeholder={t("pages.editor.stat_label")} />
              </div>
            )}
          />
        );
      case "timeline":
        return (
          <ListEditor
            items={block.items}
            max={12}
            empty={{ date: "", title: "", text: "" }}
            onChange={(items) => onChange({ ...block, items })}
            render={(item, set) => (
              <div className="grid flex-1 gap-2 sm:grid-cols-[8rem_1fr]">
                <Input value={item.date} maxLength={40} onChange={(event) => set({ ...item, date: event.target.value })} placeholder={t("pages.editor.timeline_date")} />
                <Input value={item.title} maxLength={80} onChange={(event) => set({ ...item, title: event.target.value })} placeholder={t("pages.editor.timeline_title")} />
                <Textarea className="sm:col-span-2" rows={2} value={item.text} maxLength={300} onChange={(event) => set({ ...item, text: event.target.value })} placeholder={t("pages.editor.timeline_text")} />
              </div>
            )}
          />
        );
    }
  })();

  return (
    <li className="rounded-2xl border border-border/70 bg-card p-3">
      <div className="mb-2 flex items-center gap-1">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{t(`pages.block.${block.type}` as MessageKey)}</span>
        <span className="ml-auto flex items-center">
          <IconButton label={t("pages.editor.move_up")} disabled={first} onClick={() => onMove(-1)}>
            <ArrowUp className="size-4" />
          </IconButton>
          <IconButton label={t("pages.editor.move_down")} disabled={last} onClick={() => onMove(1)}>
            <ArrowDown className="size-4" />
          </IconButton>
          <IconButton label={t("pages.editor.remove_block")} onClick={onRemove} danger>
            <Trash2 className="size-4" />
          </IconButton>
        </span>
      </div>
      {body}
    </li>
  );
}

function IconButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn("grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-surface-muted disabled:opacity-30", danger && "hover:text-error")}
    >
      {children}
    </button>
  );
}

function ListEditor<T>({ items, max, empty, onChange, render }: { items: T[]; max: number; empty: T; onChange: (items: T[]) => void; render: (item: T, set: (item: T) => void) => React.ReactNode }) {
  const t = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-start gap-1">
          {render(item, (next) => onChange(items.map((entry, position) => (position === index ? next : entry))))}
          {items.length > 1 ? (
            <IconButton label={t("pages.editor.remove_item")} onClick={() => onChange(items.filter((_, position) => position !== index))}>
              <X className="size-4" />
            </IconButton>
          ) : null}
        </div>
      ))}
      {items.length < max ? (
        <button type="button" onClick={() => onChange([...items, empty])} className="inline-flex items-center gap-1 self-start text-[13px] font-semibold text-primary hover:underline">
          <Plus className="size-4" />
          {t("pages.editor.add_item")}
        </button>
      ) : null}
    </div>
  );
}

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
