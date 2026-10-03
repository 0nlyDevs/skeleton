import { z } from "zod";

import { CITY_ALERT_SCOPES, CITY_ALERT_SEVERITIES } from "./city-zones";

export const createAlertSchema = z.object({
  title: z.string().trim().min(6, "Give the alert a clear title.").max(160),
  summary: z.string().trim().min(10, "Say in one sentence what is happening.").max(300),
  /** Clear actions residents can take now. */
  body: z.string().trim().min(10, "Tell residents what to do.").max(8_000),
  scope: z.enum(CITY_ALERT_SCOPES).default("ALL"),
  severity: z.enum(CITY_ALERT_SEVERITIES).default("WARNING"),
}).strict();

export type CreateAlertInput = z.infer<typeof createAlertSchema>;

export const listAlertsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(40).default(20),
});
export type ListAlertsQuery = z.infer<typeof listAlertsQuerySchema>;

export const alertSlugParamSchema = z.object({
  slug: z.string().trim().toLowerCase().min(1).max(100),
});

export const alertRecommendationsParamSchema = alertSlugParamSchema;

export const alertReachQuerySchema = z.object({ scope: z.enum(CITY_ALERT_SCOPES).default("ALL") });
