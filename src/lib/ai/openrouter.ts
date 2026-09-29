/**
 * OpenRouter client — server only.
 *
 * The API key exists in exactly one place: the process environment, read here and
 * sent in an `Authorization` header. It is never exposed to the client, never
 * returned by an endpoint, and never logged (the logger redacts it).
 *
 * Three behaviours matter more than the happy path:
 *
 *   * **Hard timeout.** A provider that hangs must not hold a Node worker open.
 *     `AbortSignal.timeout` covers the whole request, connection included.
 *   * **Fallback model.** A 429 or 5xx on the primary model retries once against a
 *     cheaper model, so a quota exhaustion degrades instead of failing.
 *   * **No key, no crash.** Without credentials the app must still run; the
 *     caller receives a `ServiceUnavailableError` and the UI shows a friendly
 *     message. AI is never on the critical path.
 */

import { ServiceUnavailableError } from "@/lib/errors";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

import { AI_SYSTEM_PROMPT, type ChatMessage } from "./prompts";

const REQUEST_TIMEOUT_MS = 30_000;

export interface CompletionRequest {
  readonly messages: readonly ChatMessage[];
  readonly maxTokens?: number;
  readonly temperature?: number;
}

export interface CompletionResult {
  readonly text: string;
  readonly model: string;
  readonly usage: { readonly promptTokens: number; readonly completionTokens: number };
}

interface OpenRouterChoice {
  message?: { content?: string };
}

interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

export function isAiConfigured(): boolean {
  return env.aiEnabled;
}

async function callModel(
  model: string,
  request: CompletionRequest,
): Promise<CompletionResult> {
  const response = await fetch(`${env.OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY ?? ""}`,
      "Content-Type": "application/json",
      // OpenRouter uses these for attribution; harmless and required by their terms.
      "HTTP-Referer": env.appUrl,
      "X-Title": "Webcup Base",
    },
    body: JSON.stringify({
      model,
      messages: request.messages,
      max_tokens: request.maxTokens ?? 600,
      temperature: request.temperature ?? 0.4,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    // Never cache a completion at the transport layer; the app cache handles it.
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    // Truncated: a provider error page can be huge, and this is a log line.
    throw new Error(
      `OpenRouter responded ${response.status}: ${body.slice(0, 300) || response.statusText}`,
    );
  }

  const data = (await response.json()) as OpenRouterResponse;
  const text = data.choices?.[0]?.message?.content?.trim();

  if (!text) {
    throw new Error("OpenRouter returned an empty completion.");
  }

  return {
    text,
    model,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
    },
  };
}

/**
 * Complete a prompt, falling back to the configured secondary model.
 * Throws `ServiceUnavailableError` when every attempt fails.
 */
export async function complete(request: CompletionRequest): Promise<CompletionResult> {
  if (!isAiConfigured()) {
    throw new ServiceUnavailableError(
      "The assistant is not configured on this deployment. Everything else works as usual.",
    );
  }

  const primary = env.OPENROUTER_MODEL;
  const fallback = env.OPENROUTER_FALLBACK_MODEL;

  try {
    return await callModel(primary, request);
  } catch (primaryError) {
    logger.warn("primary AI model failed", { model: primary, error: primaryError });

    if (!fallback || fallback === primary) {
      throw new ServiceUnavailableError(
        "The assistant is briefly unavailable. Please try again in a moment.",
      );
    }

    try {
      const result = await callModel(fallback, request);
      logger.info("AI fallback model served the request", { model: fallback });
      return result;
    } catch (fallbackError) {
      logger.error("all AI models failed", { primary, fallback, error: fallbackError });
      throw new ServiceUnavailableError(
        "The assistant is briefly unavailable. Please try again in a moment.",
      );
    }
  }
}

export interface AiQuota {
  /** `null` when the key has no spend cap configured. */
  readonly limitUsd: number | null;
  readonly usageUsd: number;
  readonly remainingUsd: number | null;
}

let quotaCache: { value: AiQuota | null; expiresAt: number } | undefined;
const QUOTA_TTL_MS = 60_000;

/**
 * Remaining credit on the configured key, as reported by OpenRouter.
 *
 * Best-effort by design: this is observability, so a slow or failing quota
 * endpoint must never affect the health check. The result is cached for a minute
 * because the health endpoint may be polled.
 */
export async function getAiQuota(): Promise<AiQuota | null> {
  if (!isAiConfigured()) return null;
  if (quotaCache && quotaCache.expiresAt > Date.now()) return quotaCache.value;

  try {
    const response = await fetch(`${env.OPENROUTER_BASE_URL.replace(/\/v1$/, "")}/api/v1/key`, {
      headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY ?? ""}` },
      signal: AbortSignal.timeout(3_000),
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`quota endpoint responded ${response.status}`);

    const body = (await response.json()) as {
      data?: { limit?: number | null; usage?: number; limit_remaining?: number | null };
    };

    const value: AiQuota = {
      limitUsd: body.data?.limit ?? null,
      usageUsd: body.data?.usage ?? 0,
      remainingUsd: body.data?.limit_remaining ?? null,
    };

    quotaCache = { value, expiresAt: Date.now() + QUOTA_TTL_MS };
    return value;
  } catch (error) {
    logger.debug("AI quota lookup failed", { error });
    quotaCache = { value: null, expiresAt: Date.now() + QUOTA_TTL_MS };
    return null;
  }
}

/** System prompt re-exported so the service never has to import prompts directly. */
export { AI_SYSTEM_PROMPT };
