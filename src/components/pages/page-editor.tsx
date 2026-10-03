"use client";

import {
  AlignLeft,
  BarChart3,
  Clock,
  ExternalLink,
  Eye,
  Heading,
  Image as ImageIcon,
  Images,
  Link2,
  Loader2,
  Minus,
  PenLine,
  Plus,
  Quote,
  Route,
  Video,
} from "lucide-react";
import Link from "@/components/ui/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { PageDto } from "@/modules/pages/pages.dto";
import { MAX_PAGE_BLOCKS, PAGE_FONTS, PAGE_THEMES, type PageBlock, type PageBlockType } from "@/modules/pages/pages.schema";

import { BlockEditor, ImagePicker, type ImageMap } from "./block-editor";
import { PageRenderer } from "./page-renderer";
import { PAGE_TEMPLATES, type PageTemplate } from "./page-templates";
import { PAGE_THEME_STYLES } from "./page-themes";

const BLOCK_ICONS: Record<PageBlockType, typeof Heading> = {
  heading: Heading,
  text: AlignLeft,
  image: ImageIcon,
  gallery: Images,
  quote: Quote,
  link: Link2,
  video: Video,
  divider: Minus,
  countdown: Clock,
  stats: BarChart3,
  timeline: Route,
};

function newBlock(type: PageBlockType): PageBlock {
  const id = `${type.slice(0, 2)}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  switch (type) {
    case "heading": return { id, type, text: "", level: 2 };
    case "text": return { id, type, text: "" };
    case "image": return { id, type, uploadId: "", caption: "", alt: "" };
    case "gallery": return { id, type, uploadIds: [] };
    case "quote": return { id, type, text: "", author: "" };
    case "link": return { id, type, label: "", url: "" };
    case "video": return { id, type, provider: "youtube", videoId: "" };
    case "divider": return { id, type };
    case "countdown": return { id, type, at: new Date(Date.now() + 7 * 86_400_000).toISOString(), label: "" };
    case "stats": return { id, type, items: [{ value: "", label: "" }] };
    case "timeline": return { id, type, items: [{ date: "", title: "", text: "" }] };
  }
}

/** Blocks the visitor would see as broken are left out of the save. */
function isComplete(block: PageBlock): boolean {
  switch (block.type) {
    case "image": return Boolean(block.uploadId);
    case "gallery": return block.uploadIds.length > 0;
    case "video": return Boolean(block.videoId);
    case "heading": case "text": case "quote": return block.text.trim().length > 0;
    case "link": return block.label.trim().length > 0 && block.url.trim().length > 0;
    case "stats": return block.items.some((item) => item.value.trim() && item.label.trim());
    case "timeline": return block.items.some((item) => item.date.trim() && item.title.trim());
    default: return true;
  }
}

function clean(block: PageBlock): PageBlock {
  if (block.type === "stats") return { ...block, items: block.items.filter((item) => item.value.trim() && item.label.trim()) };
  if (block.type === "timeline") return { ...block, items: block.items.filter((item) => item.date.trim() && item.title.trim()) };
  return block;
}

interface Draft {
  title: string;
  tagline: string;
  slug: string;
  theme: string;
  font: string;
  coverId: string | null;
  visibility: "PUBLIC" | "UNLISTED";
  published: boolean;
  blocks: PageBlock[];
}

function draftFrom(page: PageDto | null, template: PageTemplate | null): Draft {
  if (page) {
    return { title: page.title, tagline: page.tagline ?? "", slug: page.slug, theme: page.theme, font: page.font, coverId: page.cover?.id ?? null, visibility: page.visibility, published: page.published, blocks: page.blocks };
  }
  const base = template ?? PAGE_TEMPLATES[0]!;
  return { title: base.title, tagline: base.tagline, slug: "", theme: base.theme, font: base.font, coverId: null, visibility: "PUBLIC", published: false, blocks: base.blocks.map((block) => ({ ...block })) };
}

export function PageEditor({ initial }: { readonly initial: PageDto | null }) {
  const t = useTranslation();
  const router = useRouter();
  const [template, setTemplate] = useState<PageTemplate | null>(initial ? PAGE_TEMPLATES[0]! : null);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(initial, null));
  const [images, setImages] = useState<ImageMap>(() => ({ ...(initial?.images ?? {}) }));
  const [saved, setSaved] = useState<PageDto | null>(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"edit" | "preview">("edit");

  const update = (patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setDirty(true);
  };
  const setBlock = (index: number, block: PageBlock) => update({ blocks: draft.blocks.map((entry, position) => (position === index ? block : entry)) });
  const addImage = (image: ImageMap[string]) => setImages((current) => ({ ...current, [image.id]: image }));

  // Leaving with unsaved work asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const preview = useMemo(
    () => ({
      title: draft.title || t("pages.editor.untitled"),
      tagline: draft.tagline || null,
      theme: draft.theme,
      font: draft.font,
      cover: draft.coverId ? (images[draft.coverId] ?? null) : null,
      blocks: draft.blocks.filter(isComplete),
      images,
    }),
    [draft, images, t],
  );

  const save = async (publish?: boolean) => {
    if (saving) return;
    if (!draft.title.trim()) {
      setError(t("pages.editor.need_title"));
      return;
    }
    setSaving(true);
    setError(null);
    const body = {
      title: draft.title.trim(),
      tagline: draft.tagline.trim(),
      theme: draft.theme,
      font: draft.font,
      coverId: draft.coverId,
      visibility: draft.visibility,
      published: publish ?? draft.published,
      blocks: draft.blocks.filter(isComplete).map(clean),
      ...(draft.slug.trim() ? { slug: draft.slug.trim().toLowerCase() } : {}),
    };
    try {
      const response = saved
        ? await apiFetch<{ data: PageDto }>(`/api/pages/${encodeURIComponent(saved.slug)}`, { method: "PATCH", body })
        : await apiFetch<{ data: PageDto }>("/api/pages", { method: "POST", body });
      setSaved(response.data);
      setDraft((current) => ({ ...current, slug: response.data.slug, published: response.data.published }));
      setDirty(false);
      toast.success(response.data.published ? t("pages.editor.published") : t("pages.editor.saved"));
      if (!saved || saved.slug !== response.data.slug) router.replace(`/pages/${encodeURIComponent(response.data.slug)}/edit`);
    } catch (caught) {
      setError(describeApiError(caught, t));
    } finally {
      setSaving(false);
    }
  };

  if (!template && !initial) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("pages.editor.choose_template")}</h1>
          <p className="text-sm text-muted-foreground">{t("pages.editor.choose_template_hint")}</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PAGE_TEMPLATES.map((entry) => (
            <li key={entry.key}>
              <button
                type="button"
                onClick={() => {
                  setTemplate(entry);
                  setDraft(draftFrom(null, entry));
                }}
                className="group flex w-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-card text-left transition-shadow hover:shadow-lg focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span className={cn("h-20 bg-gradient-to-br", PAGE_THEME_STYLES[entry.theme as keyof typeof PAGE_THEME_STYLES].swatch)} />
                <span className="flex flex-col gap-0.5 p-3">
                  <span className="font-semibold">{t(`pages.template.${entry.key}` as MessageKey)}</span>
                  <span className="text-[0.8125rem] text-muted-foreground">{t(`pages.template.${entry.key}_hint` as MessageKey)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold tracking-tight">{saved ? t("pages.editor.edit_title") : t("pages.editor.new_title")}</h1>
        <div className="flex rounded-full bg-surface-muted p-1 lg:hidden" role="tablist">
          {(["edit", "preview"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={view === value}
              onClick={() => setView(value)}
              className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[0.8125rem] font-semibold", view === value ? "bg-card shadow-sm" : "text-muted-foreground")}
            >
              {value === "edit" ? <PenLine className="size-3.5" /> : <Eye className="size-3.5" />}
              {t(value === "edit" ? "pages.editor.tab_edit" : "pages.editor.tab_preview")}
            </button>
          ))}
        </div>
        {saved?.published ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/p/${encodeURIComponent(saved.slug)}`} target="_blank">
              <ExternalLink />
              {t("pages.editor.open")}
            </Link>
          </Button>
        ) : null}
        <Button variant="secondary" onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : null}
          {t("pages.editor.save")}
        </Button>
        <Button onClick={() => void save(!draft.published)} disabled={saving}>
          {draft.published ? t("pages.editor.unpublish") : t("pages.editor.publish")}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="rounded-xl bg-error/10 px-3 py-2 text-[0.8125rem] font-medium text-error">
          {error}
        </p>
      ) : null}
      {dirty ? <p className="text-[0.75rem] text-muted-foreground">{t("pages.editor.unsaved")}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className={cn("flex flex-col gap-4", view === "preview" && "hidden lg:flex")}>
          <Card className="flex flex-col gap-3 p-4">
            <label className="flex flex-col gap-1 text-[0.8125rem]">
              <span className="font-medium text-muted-foreground">{t("pages.editor.title")}</span>
              <Input value={draft.title} maxLength={120} onChange={(event) => update({ title: event.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-[0.8125rem]">
              <span className="font-medium text-muted-foreground">{t("pages.editor.tagline")}</span>
              <Input value={draft.tagline} maxLength={200} onChange={(event) => update({ tagline: event.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-[0.8125rem]">
              <span className="font-medium text-muted-foreground">{t("pages.editor.address")}</span>
              <span className="flex items-center gap-1">
                <span className="text-muted-foreground">/p/</span>
                <Input
                  value={draft.slug}
                  maxLength={60}
                  placeholder={t("pages.editor.address_auto")}
                  onChange={(event) => update({ slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                />
              </span>
            </label>
            <div className="flex flex-col gap-1 text-[0.8125rem]">
              <span className="font-medium text-muted-foreground">{t("pages.editor.cover")}</span>
              <ImagePicker
                image={draft.coverId ? (images[draft.coverId] ?? null) : null}
                label={t("pages.editor.pick_cover")}
                onPick={(image) => {
                  addImage(image);
                  update({ coverId: image.id });
                }}
                onClear={() => update({ coverId: null })}
              />
            </div>
            <fieldset className="flex flex-col gap-1.5 text-[0.8125rem]">
              <legend className="mb-1 font-medium text-muted-foreground">{t("pages.editor.theme")}</legend>
              <div className="flex flex-wrap gap-2">
                {PAGE_THEMES.map((name) => (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={draft.theme === name}
                    title={t(`pages.theme.${name}` as MessageKey)}
                    aria-label={t(`pages.theme.${name}` as MessageKey)}
                    onClick={() => update({ theme: name })}
                    className={cn("size-9 rounded-full bg-gradient-to-br ring-offset-2 ring-offset-card", PAGE_THEME_STYLES[name].swatch, draft.theme === name && "ring-2 ring-primary")}
                  />
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-3 text-[0.8125rem]">
              <label className="flex flex-col gap-1">
                <span className="font-medium text-muted-foreground">{t("pages.editor.font")}</span>
                <select value={draft.font} onChange={(event) => update({ font: event.target.value })} className="h-10 rounded-lg border border-border bg-surface px-2">
                  {PAGE_FONTS.map((font) => (
                    <option key={font} value={font}>
                      {t(`pages.font.${font}` as MessageKey)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-medium text-muted-foreground">{t("pages.editor.visibility")}</span>
                <select
                  value={draft.visibility}
                  onChange={(event) => update({ visibility: event.target.value === "UNLISTED" ? "UNLISTED" : "PUBLIC" })}
                  className="h-10 rounded-lg border border-border bg-surface px-2"
                >
                  <option value="PUBLIC">{t("pages.visibility.PUBLIC")}</option>
                  <option value="UNLISTED">{t("pages.visibility.UNLISTED")}</option>
                </select>
              </label>
            </div>
            <label className="flex items-center justify-between gap-3 rounded-xl bg-surface-muted px-3 py-2 text-[0.8125rem]">
              <span>
                <span className="block font-semibold">{t("pages.editor.published_label")}</span>
                <span className="text-muted-foreground">{draft.published ? t("pages.editor.published_on") : t("pages.editor.published_off")}</span>
              </span>
              <Switch checked={draft.published} onCheckedChange={(published) => update({ published })} />
            </label>
          </Card>

          <ol className="flex flex-col gap-3">
            {draft.blocks.map((block, index) => (
              <BlockEditor
                key={block.id}
                block={block}
                images={images}
                first={index === 0}
                last={index === draft.blocks.length - 1}
                onChange={(next) => setBlock(index, next)}
                onImage={addImage}
                onRemove={() => update({ blocks: draft.blocks.filter((_, position) => position !== index) })}
                onMove={(delta) => {
                  const blocks = [...draft.blocks];
                  const target = index + delta;
                  [blocks[index], blocks[target]] = [blocks[target]!, blocks[index]!];
                  update({ blocks });
                }}
              />
            ))}
          </ol>

          {draft.blocks.length < MAX_PAGE_BLOCKS ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" className="self-start">
                  <Plus />
                  {t("pages.editor.add_block")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-56">
                {(Object.keys(BLOCK_ICONS) as PageBlockType[]).map((type) => {
                  const Icon = BLOCK_ICONS[type];
                  return (
                    <DropdownMenuItem key={type} onSelect={() => update({ blocks: [...draft.blocks, newBlock(type)] })}>
                      <Icon />
                      {t(`pages.block.${type}` as MessageKey)}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <div className={cn("lg:sticky lg:top-20 lg:self-start", view === "edit" && "hidden lg:block")}>
          <p className="mb-2 text-[0.75rem] font-semibold uppercase tracking-wide text-muted-foreground">{t("pages.editor.tab_preview")}</p>
          <div className="max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-2xl border border-border/70 shadow-sm">
            <PageRenderer page={preview} />
          </div>
        </div>
      </div>
    </div>
  );
}
