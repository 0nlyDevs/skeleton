import { z } from "zod";

export const ANNOUNCEMENT_CATEGORIES = ["ANNOUNCEMENT", "SERVICE_CHANGE", "PRACTICAL", "EVENT", "ALERT"] as const;

export const announcementInputSchema = z
  .object({
    title: z.string().trim().min(3, "Give the announcement a title.").max(160),
    summary: z.string().trim().min(5, "Write a short summary.").max(300),
    body: z.string().trim().min(10, "Write the announcement.").max(20_000),
    category: z.enum(ANNOUNCEMENT_CATEGORIES).default("ANNOUNCEMENT"),
    pinned: z.boolean().default(false),
    serviceId: z.string().trim().max(40).nullable().optional(),
    coverImage: z.string().trim().max(200).regex(/^\/api\/files\/[A-Za-z0-9_-]+$/, "Upload the image again and retry.").nullable().optional(),
    published: z.boolean().default(true),
  })
  .strict();
export type AnnouncementInput = z.infer<typeof announcementInputSchema>;

export const announcementSlugParamSchema = z.object({ slug: z.string().trim().toLowerCase().min(1).max(100) });

export const listAnnouncementsQuerySchema = z.object({
  category: z.enum(ANNOUNCEMENT_CATEGORIES).optional(),
  service: z.string().trim().max(80).optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  drafts: z.enum(["1", "0"]).optional(),
});
export type ListAnnouncementsQuery = z.infer<typeof listAnnouncementsQuerySchema>;
