import { z } from "zod";

import { idSchema } from "@/lib/validate";

export const GROUP_NAME_MAX = 80;
export const GROUP_DESCRIPTION_MAX = 1_000;

const nameField = z
  .string()
  .max(GROUP_NAME_MAX * 2)
  .transform((value) => value.trim().replace(/\s+/g, " "))
  .refine((value) => value.length >= 3, "Use at least 3 characters.")
  .refine((value) => value.length <= GROUP_NAME_MAX, `Use at most ${GROUP_NAME_MAX} characters.`);

const descriptionField = z
  .string()
  .max(GROUP_DESCRIPTION_MAX * 2)
  .transform((value) => value.trim())
  .refine((value) => value.length <= GROUP_DESCRIPTION_MAX, `Use at most ${GROUP_DESCRIPTION_MAX} characters.`);

/** Local upload path only — an external URL would be a tracking beacon. */
const coverField = z
  .string()
  .trim()
  .max(200)
  .regex(/^\/api\/files\/[A-Za-z0-9_-]+$/, "Upload the image again and retry.");

export const groupPrivacySchema = z.enum(["PUBLIC", "PRIVATE"]);

export const createGroupSchema = z.object({
  name: nameField,
  description: descriptionField.optional(),
  privacy: groupPrivacySchema.default("PUBLIC"),
  requiresApproval: z.boolean().default(false),
  coverImage: coverField.nullable().optional(),
});
export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const updateGroupSchema = z
  .object({
    name: nameField.optional(),
    description: descriptionField.optional(),
    privacy: groupPrivacySchema.optional(),
    requiresApproval: z.boolean().optional(),
    coverImage: coverField.nullable().optional(),
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: "Provide at least one field to update.",
  });
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;

export const groupSlugParamsSchema = z.object({
  slug: z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/, "Invalid group."),
});

export const groupMemberParamsSchema = groupSlugParamsSchema.extend({ userId: idSchema });

export const listGroupsQuerySchema = z.object({
  scope: z.enum(["discover", "mine"]).default("discover"),
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListGroupsQuery = z.infer<typeof listGroupsQuerySchema>;

export const listMembersQuerySchema = z.object({
  status: z.enum(["ACTIVE", "PENDING", "BANNED"]).default("ACTIVE"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListMembersQuery = z.infer<typeof listMembersQuerySchema>;

/** Roles a manager may hand out. OWNER is only ever transferred, never set. */
export const assignableGroupRoleSchema = z.enum(["ADMIN", "MODERATOR", "MEMBER"]);

export const memberActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject") }),
  z.object({ action: z.literal("remove") }),
  z.object({ action: z.literal("ban") }),
  z.object({ action: z.literal("unban") }),
  z.object({ action: z.literal("role"), role: assignableGroupRoleSchema }),
]);
export type MemberActionInput = z.infer<typeof memberActionSchema>;

export const addGroupMemberSchema = z.object({ userId: idSchema });
