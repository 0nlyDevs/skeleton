import { z } from "zod";

export const CITY_REQUEST_STATUSES = ["NEW", "IN_PROGRESS", "WAITING_CITIZEN", "RESOLVED", "CLOSED"] as const;
export const CITY_REQUEST_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

export const createCityRequestSchema = z
  .object({
    serviceId: z.string().trim().max(40).nullable().optional(),
    subject: z.string().trim().min(3, "Give your request a subject.").max(160),
    message: z.string().trim().min(10, "Describe your request in a few words.").max(5000),
  })
  .strict();
export type CreateCityRequestInput = z.infer<typeof createCityRequestSchema>;

export const cityRequestRefParamSchema = z.object({
  reference: z.string().trim().toUpperCase().regex(/^TN-\d{6}$/, "Invalid reference."),
});

export const listCityRequestsQuerySchema = z.object({
  scope: z.enum(["mine", "all", "assigned", "unassigned"]).default("mine"),
  status: z.enum([...CITY_REQUEST_STATUSES, "OPEN", "DONE"]).optional(),
  service: z.string().trim().max(80).optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListCityRequestsQuery = z.infer<typeof listCityRequestsQuerySchema>;

export const updateCityRequestSchema = z
  .object({
    status: z.enum(CITY_REQUEST_STATUSES).optional(),
    priority: z.enum(CITY_REQUEST_PRIORITIES).optional(),
    /** `"me"` to take the request, `null` to release it. */
    assignee: z.union([z.literal("me"), z.null()]).optional(),
  })
  .strict()
  .refine((value) => value.status !== undefined || value.priority !== undefined || value.assignee !== undefined, "Nothing to update.");
export type UpdateCityRequestInput = z.infer<typeof updateCityRequestSchema>;

export const cityRequestMessageSchema = z
  .object({
    body: z.string().trim().min(1, "Write a message.").max(5000),
    internal: z.boolean().default(false),
  })
  .strict();
