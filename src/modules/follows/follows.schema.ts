import { z } from "zod";

import { idSchema } from "@/lib/validate";

export const publicUsernameParamsSchema = z.object({
  username: z.string().trim().min(1).max(30).regex(/^[a-zA-Z0-9_.-]+$/),
});

export const followUserParamsSchema = z.object({ id: idSchema });

export const searchUsersQuerySchema = z.object({
  q: z.string().trim().min(1).max(60),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export type SearchUsersQuery = z.infer<typeof searchUsersQuerySchema>;
