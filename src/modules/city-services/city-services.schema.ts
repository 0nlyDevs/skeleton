import { z } from "zod";

/** Icons a service may use (rendered from lucide, never arbitrary markup). */
export const SERVICE_ICONS = [
  "building", "zap", "droplets", "wind", "bus", "heart-pulse", "id-card", "home", "shield", "recycle",
  "graduation-cap", "trees", "wrench", "satellite", "rocket", "landmark", "users", "leaf",
] as const;

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
    icon: z.enum(SERVICE_ICONS).default("building"),
    sortOrder: z.number().int().min(0).max(1000).default(0),
    active: z.boolean().default(true),
  })
  .strict();

export type ServiceInput = z.infer<typeof serviceInputSchema>;

export const serviceSlugParamSchema = z.object({ slug: z.string().trim().toLowerCase().min(1).max(80) });

export const listServicesQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.string().trim().max(60).optional(),
  includeInactive: z.enum(["1", "0"]).optional(),
});
