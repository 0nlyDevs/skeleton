import { z } from "zod";

import { paginationQuerySchema } from "@/lib/pagination";
import { booleanQuerySchema, hasAtLeastOneDefined, idSchema } from "@/lib/validate";

export const listNotificationsQuerySchema = paginationQuerySchema.extend({
  unreadOnly: booleanQuerySchema.optional(),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

/**
 * Marking read accepts an explicit id list, or nothing at all to mean "all".
 * An empty array is rejected on purpose: it would be ambiguous between "nothing"
 * and "everything", and silently marking everything read on a malformed request
 * would destroy a user's unread state.
 */
export const markNotificationsReadSchema = z.object({
  ids: z.array(idSchema).min(1).max(200).optional(),
});

export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;

export const notificationIdParamSchema = z.object({ id: idSchema });

export const notificationPreferencesSchema = z
  .object({
    emailOnMessage: z.boolean().optional(),
    emailOnMention: z.boolean().optional(),
    emailOnSystem: z.boolean().optional(),
  })
  .refine(hasAtLeastOneDefined, { message: "Provide at least one preference to update." });

export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;
