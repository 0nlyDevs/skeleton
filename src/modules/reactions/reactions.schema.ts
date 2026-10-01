import { z } from "zod";

import { idSchema } from "@/lib/validate";
import { REACTION_TYPES } from "@/types";

export const reactionParamsSchema = z.object({ id: idSchema });

export const setReactionSchema = z.object({
  type: z.enum(REACTION_TYPES),
});

export type SetReactionInput = z.infer<typeof setReactionSchema>;
