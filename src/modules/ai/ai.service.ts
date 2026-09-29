/**
 * AI features.
 *
 * Every capability goes through the same three gates:
 *
 *   1. **Authorization.** Post actions load the post through the posts service,
 *      so the AI can never read a draft the caller could not read themselves.
 *      The model is a *renderer* over data the caller already has — it is never
 *      a way to bypass access control.
 *   2. **Caching.** Identical prompts are answered from the in-process cache for
 *      an hour, and concurrent identical requests share one upstream call. This
 *      is what keeps a free-tier API key inside its quota during a contest.
 *   3. **Fallback.** A provider failure becomes a friendly 503, never a 500 and
 *      never a broken page.
 *
 * Output is returned as text and rendered as text. Nothing the model produces is
 * parsed into a command, a query, or an authorization decision.
 */

import { cacheKey, getOrSet, peek } from "@/lib/cache";
import { isAiConfigured, complete } from "@/lib/ai/provider";
import { buildSummarizePrompt, buildTagPrompt, buildAssistantMessages, parseTags } from "@/lib/ai/prompts";
import { env } from "@/lib/env";
import { ServiceUnavailableError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { AuthUser } from "@/types";

import { getPostForActor } from "../posts/posts.service";
import type { AiChatInput, AiPostActionInput } from "./ai.schema";

/** One hour: long enough to absorb a demo, short enough to stay current. */
const CACHE_TTL_MS = 60 * 60 * 1000;

export interface AiChatResult {
  readonly reply: string;
  readonly model: string;
  readonly cached: boolean;
}

export interface AiTagsResult {
  readonly tags: string[];
  readonly model: string;
  readonly cached: boolean;
}

function assertConfigured(): void {
  if (!isAiConfigured()) {
    throw new ServiceUnavailableError(
      "The assistant is not configured on this deployment. Everything else works as usual.",
    );
  }
}

export async function chat(input: AiChatInput, actor: AuthUser): Promise<AiChatResult> {
  assertConfigured();

  const messages = buildAssistantMessages(input.history, input.prompt);

  // The key covers the full conversation and the model, so two different chats
  // can never collide on a shared prefix. It is also scoped to the user: cache
  // entries are process-wide, and an assistant reply may echo user content.
  const key = cacheKey("ai:chat", actor.id, env.AI_MODEL, JSON.stringify(messages));

  // Determined before the call, so a concurrent request that joins an in-flight
  // computation reports the truth instead of claiming a cache hit.
  const cached = peek(key) !== undefined;

  const result = await getOrSet(key, CACHE_TTL_MS, () => complete({ messages }));

  return { reply: result.text, model: result.model, cached };
}

export async function summarizePost(
  input: AiPostActionInput,
  actor: AuthUser,
): Promise<AiChatResult> {
  assertConfigured();

  // Reuses the posts module's visibility rules — a draft the caller cannot read
  // is a 404 here too, not a summary.
  const post = await getPostForActor(input.postId, actor);

  const key = cacheKey("ai:summarize", input.postId, post.updatedAt);

  const cached = peek(key) !== undefined;

  const result = await getOrSet(key, CACHE_TTL_MS, () =>
    complete({
      messages: [
        { role: "system", content: "You summarise documents faithfully and briefly." },
        { role: "user", content: buildSummarizePrompt(post.title, post.body) },
      ],
      maxTokens: 300,
    }),
  );

  return { reply: result.text, model: result.model, cached };
}

export async function generateTags(
  input: AiPostActionInput,
  actor: AuthUser,
): Promise<AiTagsResult> {
  assertConfigured();

  const post = await getPostForActor(input.postId, actor);

  const key = cacheKey("ai:tags", input.postId, post.updatedAt);

  const cached = peek(key) !== undefined;

  const result = await getOrSet(key, CACHE_TTL_MS, () =>
    complete({
      messages: [
        {
          role: "system",
          content: "You suggest short topical tags. Answer with tags only.",
        },
        { role: "user", content: buildTagPrompt(post.title, post.body) },
      ],
      maxTokens: 80,
      temperature: 0.2,
    }),
  );

  const tags = parseTags(result.text);
  logger.info("generated tags", { postId: input.postId, count: tags.length });

  return { tags, model: result.model, cached };
}

/** Whether the assistant should be shown at all in the UI. */
export function isAssistantAvailable(): boolean {
  return isAiConfigured();
}
