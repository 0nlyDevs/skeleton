import { z } from "zod";

import { passwordSchema } from "@/lib/auth/password-policy";
import { roleSchema } from "@/lib/auth/roles";
import { birthDateSchema, personNameSchema, usernameSchema } from "@/lib/validation/profile";
import { paginationQuerySchema, sortOrderSchema } from "@/lib/pagination";
import {
  booleanQuerySchema,
  hasAtLeastOneDefined,
  idSchema,
} from "@/lib/validate";
import { CITY_ZONE_IDS } from "@/modules/alerts/city-zones";

/** Local upload path only — an external URL here would be a tracking beacon. */
const avatarPathSchema = z
  .string()
  .trim()
  .max(200)
  .regex(/^\/api\/files\/[A-Za-z0-9_-]+$/, "Upload the image again and retry.");

export const updateProfileSchema = z
  .object({
    // The display name is derived from first + last name; it is not editable
    // on its own, so the two can never disagree.
    username: usernameSchema.optional(),
    firstName: personNameSchema.optional(),
    lastName: personNameSchema.optional(),
    birthDate: birthDateSchema.nullable().optional(),
    bio: z
      .string()
      .transform((value) => value.trim())
      .refine((value) => value.length <= 500, "Keep your bio under 500 characters.")
      .optional(),
    image: avatarPathSchema.nullable().optional(),
    banner: avatarPathSchema.nullable().optional(),
    /** Privacy: show others when I am online and when I was last seen. */
    showPresence: z.boolean().optional(),
    /** Suggest my town on new posts and centre the map on me. */
    autoLocation: z.boolean().optional(),
    /** Broad home district for location-scoped city alerts. */
    cityZone: z.enum(CITY_ZONE_IDS).nullable().optional(),
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

/** F34 — the agents' view only ever lists resident accounts. */
export const agentListCitizensQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(120).optional(),
  status: z.enum(["all", "active", "suspended", "unverified"]).default("all"),
});

export type AgentListCitizensQuery = z.infer<typeof agentListCitizensQuerySchema>;

export const userIdParamSchema = z.object({ id: idSchema });

export const sessionIdParamSchema = z.object({ id: idSchema });

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

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password.").max(128),
    newPassword: passwordSchema,
    confirmPassword: z.string().max(128),
  })
  .superRefine((value, context) => {
    if (value.newPassword !== value.confirmPassword) {
      context.addIssue({ code: "custom", path: ["confirmPassword"], message: "The two passwords do not match." });
    }
    if (value.newPassword === value.currentPassword) {
      context.addIssue({
        code: "custom",
        path: ["newPassword"],
        message: "Choose a password different from the current one.",
      });
    }
  });

/** First password for an account created through Google/GitHub. */
export const setInitialPasswordSchema = z
  .object({ newPassword: passwordSchema, confirmPassword: z.string().max(128) })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "The two passwords do not match.",
  });

export type SetInitialPasswordInput = z.infer<typeof setInitialPasswordSchema>;

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
