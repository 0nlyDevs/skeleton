import { z } from "zod";

import { passwordSchema } from "@/lib/auth/password-policy";
import { roleSchema } from "@/lib/auth/roles";
import { paginationQuerySchema, sortOrderSchema } from "@/lib/pagination";
import {
  booleanQuerySchema,
  hasAtLeastOneDefined,
  idSchema,
  nameSchema,
} from "@/lib/validate";

/** Local upload path only — an external URL here would be a tracking beacon. */
const avatarPathSchema = z
  .string()
  .trim()
  .max(200)
  .regex(/^\/api\/files\/[A-Za-z0-9_-]+$/, "Upload the image again and retry.");

export const updateProfileSchema = z
  .object({
    name: nameSchema.optional(),
    bio: z
      .string()
      .transform((value) => value.trim())
      .refine((value) => value.length <= 500, "Keep your bio under 500 characters.")
      .optional(),
    image: avatarPathSchema.nullable().optional(),
  })
  .refine(hasAtLeastOneDefined, { message: "Provide at least one field to update." });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const adminListUsersQuerySchema = paginationQuerySchema.extend({
  /** Matches name or email, case-insensitively. */
  q: z.string().trim().max(120).optional(),
  role: roleSchema.optional(),
  banned: booleanQuerySchema.optional(),
  emailVerified: booleanQuerySchema.optional(),
  sort: z.enum(["createdAt", "name", "email", "role"]).default("createdAt"),
  order: sortOrderSchema.default("desc"),
});

export type AdminListUsersQuery = z.infer<typeof adminListUsersQuerySchema>;

export const userIdParamSchema = z.object({ id: idSchema });

export const updateUserRoleSchema = z.object({
  role: roleSchema,
});

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

export const updateUserBanSchema = z
  .object({
    banned: z.boolean(),
    reason: z
      .string()
      .transform((value) => value.trim())
      .refine((value) => value.length <= 300, "Keep the reason under 300 characters.")
      .optional(),
    /** ISO date; omit for an indefinite ban. */
    expiresAt: z.string().trim().max(40).optional(),
  })
  .refine((value) => !value.banned || (value.reason?.length ?? 0) >= 3, {
    message: "A ban needs a short reason.",
    path: ["reason"],
  });

export type UpdateUserBanInput = z.infer<typeof updateUserBanSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password.").max(128),
  newPassword: passwordSchema,
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
