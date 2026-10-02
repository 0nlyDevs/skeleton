import { z } from "zod";

import { MAX_MESSAGE_LENGTH } from "./messages.constants";

const contentField = z
  .string()
  .max(MAX_MESSAGE_LENGTH * 2)
  .transform((value) => value.trim())
  .refine(
    (value) => value.length <= MAX_MESSAGE_LENGTH,
    `Keep messages under ${MAX_MESSAGE_LENGTH} characters.`,
  );

export const sendMessageSchema = z
  .object({
    roomId: z.string().trim().min(1).max(120),
    content: contentField.default(""),
    /** An image uploaded beforehand by the sender. */
    uploadId: z.string().trim().min(1).max(64).optional(),
  })
  .refine((value) => value.content.length > 0 || Boolean(value.uploadId), {
    message: "Write a message or add an image.",
    path: ["content"],
  });

export const messageIdParamSchema = z.object({ id: z.string().trim().min(1).max(64) });

export const editMessageSchema = z.object({
  content: contentField.refine((value) => value.length > 0, "A message cannot be empty."),
});

export const deleteMessageQuerySchema = z.object({
  /** `me` hides it for the caller only; `everyone` removes it for all. */
  scope: z.enum(["me", "everyone"]).default("me"),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

/**
 * Query for both the initial load and the polling fallback.
 *
 * `since` is what makes polling cheap: the client sends the timestamp of the
 * newest message it holds and receives only what is newer, so a quiet room costs
 * one indexed range scan that returns nothing.
 */
export const listMessagesQuerySchema = z.object({
  /** Room id. Defaults to the shared room so `/api/messages` alone works. */
  room: z.string().trim().min(1).max(120).optional(),
  roomId: z.string().trim().min(1).max(120).optional(),
  since: z.string().trim().max(60).optional(),
  afterId: z.string().trim().min(1).max(120).optional(),
  before: z.string().trim().max(60).optional(),
  beforeId: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).refine((query) => !(query.since && query.before), {
  message: "Use either a newer-than or older-than cursor.",
}).refine((query) => (!query.afterId || Boolean(query.since)) && (!query.beforeId || Boolean(query.before)), {
  message: "A message id tie-breaker requires its matching date cursor.",
});

export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;

export const roomIdParamSchema = z.object({ roomId: z.string().trim().min(1).max(120) });
export const roomParamSchema = z.object({ id: z.string().trim().min(1).max(120) });

export const createRoomSchema = z.object({
  type: z.enum(["DIRECT", "GROUP"]).default("DIRECT"),
  name: z.string().trim().max(100).optional(),
  targetUserId: z.string().trim().min(1).max(100).optional(),
  memberIds: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
}).superRefine((room, context) => {
  if (room.type === "DIRECT" && !room.targetUserId) {
    context.addIssue({ code: "custom", path: ["targetUserId"], message: "Choose a person to message." });
  }
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;

export const addMemberSchema = z.object({
  userId: z.string().trim().min(1).max(100),
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;
