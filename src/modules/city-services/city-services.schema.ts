import { z } from "zod";

/** Icons a service may use (rendered from lucide, never arbitrary markup). */
export const SERVICE_ICONS = [
  "building", "zap", "droplets", "wind", "bus", "heart-pulse", "id-card", "home", "shield", "recycle",
  "graduation-cap", "trees", "wrench", "satellite", "rocket", "landmark", "users", "leaf",
] as const;

/** Text fields an administrator can provide in another language (F27). */
export const TRANSLATABLE_SERVICE_FIELDS = ["name", "category", "summary", "description", "howTo", "hours"] as const;

/** `{ en: { name, summary, … } }` — French is the base text, so it never appears here. */
export type ServiceTranslations = { readonly en?: Partial<Record<(typeof TRANSLATABLE_SERVICE_FIELDS)[number], string>> };

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable().transform((value) => value || null);

export const serviceInputSchema = z
  .object({
    name: z.string().trim().min(2, "Give the service a name.").max(120),
    category: z.string().trim().min(2).max(60),
    summary: z.string().trim().min(5, "Write a short summary.").max(240),
    description: z.string().trim().min(10, "Describe the service.").max(5000),
    howTo: optionalText(4000),
    email: z.string().trim().email("Enter a valid email address.").max(160).optional().nullable().or(z.literal("")).transform((value) => value || null),
    phone: optionalText(40),
    hours: optionalText(160),
    address: optionalText(200),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    /** Position on the city map; the district is derived from it on the server. */
    mapX: z.number().int().min(0).max(1000).nullable().optional(),
    mapY: z.number().int().min(0).max(640).nullable().optional(),
    emergency: z.boolean().default(false),
    icon: z.enum(SERVICE_ICONS).default("building"),
    sortOrder: z.number().int().min(0).max(1000).default(0),
    active: z.boolean().default(true),
    featured: z.boolean().default(false),
    translations: z
      .object({
        en: z
          .object({
            name: z.string().trim().max(120).optional(),
            category: z.string().trim().max(60).optional(),
            summary: z.string().trim().max(240).optional(),
            description: z.string().trim().max(5000).optional(),
            howTo: z.string().trim().max(4000).optional(),
            hours: z.string().trim().max(160).optional(),
          })
          .strict()
          .transform((copy) => Object.fromEntries(Object.entries(copy).filter(([, text]) => text))),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((value) => (value.mapX == null) === (value.mapY == null), { message: "Give both map coordinates, or neither.", path: ["mapX"] });

export type ServiceInput = z.infer<typeof serviceInputSchema>;

export const serviceSlugParamSchema = z.object({ slug: z.string().trim().toLowerCase().min(1).max(80) });

export const listServicesQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.string().trim().max(60).optional(),
  includeInactive: z.enum(["1", "0"]).optional(),
});
