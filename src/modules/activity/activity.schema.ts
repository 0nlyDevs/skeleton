import { z } from "zod";

import { paginationQuerySchema } from "@/lib/pagination";

import { ADMIN_ACTION_CATEGORIES } from "../audit/audit.schema";

export const ACTIVITY_CATEGORIES = Object.keys(ADMIN_ACTION_CATEGORIES) as (keyof typeof ADMIN_ACTION_CATEGORIES)[];
export const ACTIVITY_PERIODS = ["today", "7d", "30d", "all"] as const;

/** Filters of the agents' history. */
export const listActivityQuerySchema = paginationQuerySchema.extend({
  category: z.enum(["all", ...ACTIVITY_CATEGORIES] as [string, ...string[]]).default("all"),
  period: z.enum(ACTIVITY_PERIODS).default("30d"),
  /** Who did it: part of a staff member's name. */
  actor: z.string().trim().max(80).optional(),
  /** One element's history (a service, an announcement…). */
  targetType: z.enum(["city_request", "announcement", "service", "transport_line", "user", "webcup_request", "feature_flag"]).optional(),
  targetId: z.string().trim().max(64).optional(),
});

export type ListActivityQuery = z.infer<typeof listActivityQuerySchema>;
