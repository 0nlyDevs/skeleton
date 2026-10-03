import { z } from "zod";

import { LOCALES } from "@/lib/i18n/config";
import { personNameSchema } from "@/lib/validation/profile";

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
