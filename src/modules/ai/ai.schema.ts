import { z } from "zod";

import { MAX_HISTORY_TURNS, MAX_PROMPT_CHARS } from "@/lib/ai/prompts";
import { idSchema } from "@/lib/validate";

export const aiChatSchema = z.object({
  prompt: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, "Ask the assistant something.")
    .refine(
      (value) => value.length <= MAX_PROMPT_CHARS,
      `Keep the prompt under ${MAX_PROMPT_CHARS} characters.`,
    ),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(MAX_PROMPT_CHARS),
      }),
    )
    .max(MAX_HISTORY_TURNS * 2)
    .default([]),
});

export type AiChatInput = z.infer<typeof aiChatSchema>;

export const aiPostActionSchema = z.object({
  postId: idSchema,
});

export type AiPostActionInput = z.infer<typeof aiPostActionSchema>;
