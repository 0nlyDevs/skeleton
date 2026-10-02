/**
 * Page builder schemas, shared by the API and the editor.
 *
 * Every block is a closed, typed shape: unknown block types and unknown keys
 * are rejected, text is length-capped, links must be http(s), and videos are
 * reduced to a provider + id so the page embeds only privacy-friendly players
 * from an allow-list. Nothing in a page is ever rendered as HTML.
 */

import { z } from "zod";

export const PAGE_THEMES = ["aurora", "sunset", "ocean", "forest", "night", "paper", "mono"] as const;
export const PAGE_FONTS = ["sans", "serif", "mono"] as const;
export const MAX_PAGE_BLOCKS = 40;
export const MAX_PAGE_IMAGES = 24;

/** Slugs that would shadow app routes or mislead visitors. */
const RESERVED_SLUGS = new Set([
  "new", "edit", "admin", "api", "login", "logout", "register", "settings", "feed", "groups", "messages",
  "notifications", "profile", "search", "map", "saved", "pages", "p", "support", "help", "official", "webcup", "skeleton",
]);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "The address needs at least 3 characters.")
  .max(60, "The address is limited to 60 characters.")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, digits and single hyphens.")
  .refine((slug) => !RESERVED_SLUGS.has(slug), "This address is reserved.");

const uploadId = z.string().trim().min(1).max(40).regex(/^[a-z0-9]+$/i, "Invalid image.");
const blockId = z.string().trim().min(1).max(24).regex(/^[A-Za-z0-9_-]+$/);
const text = (max: number) => z.string().trim().min(1, "A block is empty.").max(max);
const optionalText = (max: number) => z.string().trim().max(max).default("");

/** http(s) only: `javascript:`, `data:` and friends never become a link. */
export const safeUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname) && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Enter a full web address starting with https://.");

/** Reduce a YouTube or Vimeo link to its id; any other host is refused. */
export function parseVideoUrl(value: string): { provider: "youtube" | "vimeo"; videoId: string } | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.slice(1);
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = url.searchParams.get("v") ?? url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] ?? null;
  } else if (host === "vimeo.com" || host === "player.vimeo.com") {
    const match = url.pathname.match(/(\d{6,12})/);
    return match?.[1] ? { provider: "vimeo", videoId: match[1] } : null;
  }
  return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? { provider: "youtube", videoId: id } : null;
}

export const pageBlockSchema = z.discriminatedUnion("type", [
  z.object({ id: blockId, type: z.literal("heading"), text: text(140), level: z.union([z.literal(2), z.literal(3)]).default(2) }).strict(),
  z.object({ id: blockId, type: z.literal("text"), text: text(5_000) }).strict(),
  z.object({ id: blockId, type: z.literal("image"), uploadId, caption: optionalText(200), alt: optionalText(200) }).strict(),
  z.object({ id: blockId, type: z.literal("gallery"), uploadIds: z.array(uploadId).min(1).max(6) }).strict(),
  z.object({ id: blockId, type: z.literal("quote"), text: text(500), author: optionalText(80) }).strict(),
  z.object({ id: blockId, type: z.literal("link"), label: text(60), url: safeUrlSchema }).strict(),
  z.object({ id: blockId, type: z.literal("video"), provider: z.enum(["youtube", "vimeo"]), videoId: z.string().regex(/^[A-Za-z0-9_-]{6,20}$/) }).strict(),
  z.object({ id: blockId, type: z.literal("divider") }).strict(),
  z.object({ id: blockId, type: z.literal("countdown"), at: z.string().datetime({ offset: true }), label: optionalText(80) }).strict(),
  z
    .object({
      id: blockId,
      type: z.literal("stats"),
      items: z.array(z.object({ value: text(20), label: text(60) }).strict()).min(1).max(4),
    })
    .strict(),
  z
    .object({
      id: blockId,
      type: z.literal("timeline"),
      items: z.array(z.object({ date: text(40), title: text(80), text: optionalText(300) }).strict()).min(1).max(12),
    })
    .strict(),
]);

export type PageBlock = z.infer<typeof pageBlockSchema>;
export type PageBlockType = PageBlock["type"];

export const pageBlocksSchema = z
  .array(pageBlockSchema)
  .max(MAX_PAGE_BLOCKS, `A page holds at most ${MAX_PAGE_BLOCKS} blocks.`)
  .refine((blocks) => new Set(blocks.map((block) => block.id)).size === blocks.length, "Two blocks share an id.")
  .refine((blocks) => blockImageIds(blocks).length <= MAX_PAGE_IMAGES, `A page holds at most ${MAX_PAGE_IMAGES} images.`);

/** Every upload a page's blocks reference, in order, without duplicates. */
export function blockImageIds(blocks: readonly PageBlock[]): string[] {
  const ids = blocks.flatMap((block) => (block.type === "image" ? [block.uploadId] : block.type === "gallery" ? block.uploadIds : []));
  return [...new Set(ids)];
}

const pageFields = {
  title: z.string().trim().min(1, "Give the page a title.").max(120),
  tagline: z.string().trim().max(200).optional(),
  theme: z.enum(PAGE_THEMES).default("aurora"),
  font: z.enum(PAGE_FONTS).default("sans"),
  coverId: uploadId.nullable().optional(),
  blocks: pageBlocksSchema.default([]),
  visibility: z.enum(["PUBLIC", "UNLISTED"]).default("PUBLIC"),
  published: z.boolean().default(false),
};

export const createPageSchema = z.object({ ...pageFields, slug: slugSchema.optional() }).strict();
export type CreatePageInput = z.infer<typeof createPageSchema>;

export const updatePageSchema = z
  .object({
    title: pageFields.title.optional(),
    tagline: pageFields.tagline,
    theme: z.enum(PAGE_THEMES).optional(),
    font: z.enum(PAGE_FONTS).optional(),
    coverId: uploadId.nullable().optional(),
    blocks: pageBlocksSchema.optional(),
    visibility: z.enum(["PUBLIC", "UNLISTED"]).optional(),
    published: z.boolean().optional(),
    slug: slugSchema.optional(),
  })
  .strict();
export type UpdatePageInput = z.infer<typeof updatePageSchema>;

export const pageSlugParamSchema = z.object({ slug: z.string().trim().toLowerCase().min(1).max(60) });

export const listPagesQuerySchema = z.object({
  scope: z.enum(["mine", "discover"]).default("discover"),
  sort: z.enum(["recent", "popular"]).default("recent"),
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(30).default(12),
  page: z.coerce.number().int().min(1).max(200).default(1),
});
export type ListPagesQuery = z.infer<typeof listPagesQuerySchema>;
