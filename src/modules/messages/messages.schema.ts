import { z } from "zod";

import { MAX_MESSAGE_LENGTH } from "./messages.constants";

export const sendMessageSchema = z.object({
  roomId: z.string().trim().min(1).max(120),
  content: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, "Write a message first.")
    .refine(
      (value) => value.length <= MAX_MESSAGE_LENGTH,
      `Keep messages under ${MAX_MESSAGE_LENGTH} characters.`,
    ),
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
  room: z.string().trim().min(1).max(120).default("global"),
  since: z.string().trim().max(40).optional(),
  before: z.string().trim().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;

export const roomIdParamSchema = z.object({ roomId: z.string().trim().min(1).max(120) });
