import { z } from "zod";

import { idSchema } from "@/lib/validate";

export const publicUsernameParamsSchema = z.object({
  username: z.string().trim().min(1).max(30).regex(/^[a-zA-Z0-9_.-]+$/),
});

export const followUserParamsSchema = z.object({ id: idSchema });

/** Platform roles a resident can filter people by (citizens, city agents, administrators). */
export const PEOPLE_ROLES = ["USER", "AGENT", "ADMIN"] as const;
export type PeopleRole = (typeof PEOPLE_ROLES)[number];

export const searchUsersQuerySchema = z
  .object({
    q: z.string().trim().max(60).default(""),
    role: z.enum(PEOPLE_ROLES).optional(),
    limit: z.coerce.number().int().min(1).max(20).default(10),
  })
  // Without a role, a name is needed; with one, the list of that role is enough.
  .refine((value) => value.q.length > 0 || value.role !== undefined, { message: "Type a name or choose a role.", path: ["q"] });

export type SearchUsersQuery = z.infer<typeof searchUsersQuerySchema>;
