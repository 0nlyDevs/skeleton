import { z } from "zod";

import { LOCALES } from "@/lib/i18n/config";
import { personNameSchema } from "@/lib/validation/profile";
import { CITY_ZONE_IDS } from "@/modules/alerts/city-zones";

/** F71 — at most this many residents per batch: a welcome session, not a bulk import. */
export const ASSISTED_BATCH_MAX = 50;

export const createAssistedAccountsSchema = z
  .object({
    residents: z
      .array(z.object({ firstName: personNameSchema, lastName: personNameSchema }).strict())
      .min(1, "Add at least one resident.")
      .max(ASSISTED_BATCH_MAX, "Create at most 50 accounts at a time."),
    /** The language the access sheet is printed in and the interface opens in. */
    locale: z.enum(LOCALES),
  })
  .strict();

export type CreateAssistedAccountsInput = z.infer<typeof createAssistedAccountsSchema>;

/** An administrator creates one account and decides its role. */
export const adminCreateAccountSchema = z
  .object({
    firstName: personNameSchema,
    lastName: personNameSchema,
    /** Optional: without it the person signs in with their username. */
    email: z.string().trim().toLowerCase().email("Give a valid email address.").max(160).optional(),
    role: z.enum(["USER", "AGENT", "ADMIN"]),
    cityZone: z.enum(CITY_ZONE_IDS).optional(),
    locale: z.enum(LOCALES),
  })
  .strict();

export type AdminCreateAccountInput = z.infer<typeof adminCreateAccountSchema>;
