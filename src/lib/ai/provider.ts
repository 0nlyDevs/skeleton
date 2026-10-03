/**
 * AI provider client — server only.
 *
 * Works with any OpenAI-compatible API: OpenRouter, xAI, Gemini (via
 * OpenAI-compatible endpoints), OpenAI itself, etc.
 *
 * The API key exists in exactly one place: the process environment, read here
 * and sent in an `Authorization` header. It is never exposed to the client,
 * never returned by an endpoint, and never logged (the logger redacts it).
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
 *   * **A refused key opens a circuit.** On the shared host, Apache caps the
 *     account at roughly eleven concurrent requests. A rejected key takes
 *     seconds to answer, so every assistant click holds one of those eleven
 *     slots for the duration and every other visitor gets a 500. After the
 *     first refusal the breaker fails fast for a cooldown window, so the cost is
 *     paid once instead of once per click. It closes on its own, so fixing the
 *     key needs no restart.
 */

import { ServiceUnavailableError } from "@/lib/errors";
import { brand } from "@/lib/brand";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

import { AI_SYSTEM_PROMPT, type ChatMessage, type ToolCall, type ToolDefinition } from "./prompts";

const REQUEST_TIMEOUT_MS = 30_000;

export interface CompletionRequest {
  readonly messages: readonly ChatMessage[];
  /** Server-defined, read-only tools the model may ask the server to run. */
  readonly tools?: readonly ToolDefinition[];
  readonly maxTokens?: number;
  readonly temperature?: number;
}

export interface CompletionResult {
  readonly text: string;
  /** Tool invocations requested by the model; empty for a plain answer. */
  readonly toolCalls: readonly ToolCall[];
  readonly model: string;
  readonly usage: { readonly promptTokens: number; readonly completionTokens: number };
}

interface LlmChoice {
  finish_reason?: string;
  // Most providers send a string; some send typed content parts.
  message?: {
    content?: string | Array<{ type?: string; text?: string }> | null;
    tool_calls?: ToolCall[];
  };
}

interface LlmResponse {
  choices?: LlmChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

/** The configured model does not accept tool definitions. */
export class ToolsUnsupportedError extends Error {
  constructor() {
    super("The AI model does not support tool calling.");
    this.name = "ToolsUnsupportedError";
  }
}

/** A non-2xx answer from the provider, with its status kept for routing. */
class AiProviderError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AiProviderError";
  }

  /** The key itself was refused: no other model on the same key can succeed. */
  get isCredentialError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

function extractText(content: NonNullable<LlmChoice["message"]>["content"]): string | undefined {
  if (typeof content === "string") return content.trim() || undefined;
  if (Array.isArray(content)) {
    const joined = content
      .map((part) => (typeof part.text === "string" ? part.text : ""))
      .join("")
      .trim();
    return joined || undefined;
  }
  return undefined;
}

const KEY_REJECTED_MESSAGE =
  "The assistant is misconfigured on this deployment (its API key was refused). Everything else works as usual.";

/**
 * How long a refused key keeps the circuit open. Long enough that a jury
 * clicking around does not re-pay the timeout on every visit, short enough
 * that a corrected key recovers without a redeploy.
 */
const CIRCUIT_COOLDOWN_MS = 60_000;

/** Set when the provider refuses the key; cleared by the cooldown, never by hand. */
let circuitOpenedAt = 0;

/**
 * Whether the assistant should be hidden from navigation.
 *
 * Read on the server when rendering the shell, so a deployment with a dead key
 * does not advertise a feature that cannot work. Distinct from
 * `isAiConfigured()`: the key is present but refused, which only a live request
 * can discover.
 */
export function isAiReachable(): boolean {
  return isAiConfigured() && Date.now() - circuitOpenedAt >= CIRCUIT_COOLDOWN_MS;
}

function openCircuit(): void {
  circuitOpenedAt = Date.now();
}

/** A closed circuit must not block the next attempt. */
function closeCircuit(): void {
  circuitOpenedAt = 0;
}

/**
 * Resolve the AI API key from the generic var, with backward-compatible
 * fallback to OPENROUTER_API_KEY for existing deployments.
 */
function getApiKey(): string {
  return env.AI_API_KEY ?? process.env.OPENROUTER_API_KEY ?? "";
}

export function isAiConfigured(): boolean {
  return env.aiEnabled;
}

async function callModel(
  model: string,
  request: CompletionRequest,
): Promise<CompletionResult> {
  const response = await fetch(`${env.AI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      ...(process.env.OPENROUTER_BASE_URL
        ? { "HTTP-Referer": env.appUrl, "X-Title": brand.providerTitle }
        : {}),
    },
    body: JSON.stringify({
      model,
      messages: request.messages,
      max_tokens: request.maxTokens ?? 600,
      temperature: request.temperature ?? 0.4,
      ...(request.tools && request.tools.length > 0 ? { tools: request.tools, tool_choice: "auto" } : {}),
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new AiProviderError(
      response.status,
      `AI provider responded ${response.status}: ${body.slice(0, 300) || response.statusText}`,
    );
  }

  const data = (await response.json()) as LlmResponse;
  const message = data.choices?.[0]?.message;
  const text = extractText(message?.content);
  const toolCalls = (message?.tool_calls ?? []).filter(
    (call) => call?.type === "function" && typeof call.function?.name === "string",
  );

  if (!text && toolCalls.length === 0) {
    throw new Error("AI provider returned an empty completion.");
  }

  return {
    text: text ?? "",
    toolCalls,
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

  // Fail fast while the breaker is open: the key was already refused, so waiting
  // on the provider again would only hold another Apache slot open for nothing.
  if (Date.now() - circuitOpenedAt < CIRCUIT_COOLDOWN_MS) {
    throw new ServiceUnavailableError(KEY_REJECTED_MESSAGE);
  }

  const primary = env.AI_MODEL;
  const fallback = env.AI_FALLBACK_MODEL;

  try {
    return await callModel(primary, request);
  } catch (primaryError) {
    if (
      request.tools &&
      primaryError instanceof AiProviderError &&
      [400, 404, 422].includes(primaryError.status)
    ) {
      // The model rejected the `tools` parameter; the caller degrades to
      // retrieval-in-prompt instead of failing.
      throw new ToolsUnsupportedError();
    }

    if (primaryError instanceof AiProviderError && primaryError.isCredentialError) {
      // Retrying with the fallback model would use the same refused key.
      openCircuit();
      logger.error("AI provider rejected AI_API_KEY; check the key and AI_BASE_URL", {
        status: primaryError.status,
        baseUrl: env.AI_BASE_URL,
      });
      throw new ServiceUnavailableError(KEY_REJECTED_MESSAGE);
    }

    // The primary failed but the key is fine, so the circuit must not latch.
    closeCircuit();
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
 * Remaining credit on the configured key, as reported by the provider.
 *
 * OpenRouter exposes a `/api/v1/key` endpoint that returns quota metadata.
 * Other providers may not, so this is best-effort: a failed or unsupported
 * quota endpoint returns `null` without affecting the health check.
 *
 * The result is cached for one minute because the health endpoint may be polled.
 */
export async function getAiQuota(): Promise<AiQuota | null> {
  if (!isAiConfigured()) return null;
  if (quotaCache && quotaCache.expiresAt > Date.now()) return quotaCache.value;

  try {
    const baseUrl = env.AI_BASE_URL.replace(/\/v1$/, "");
    const quotaUrl = baseUrl.endsWith("/api/v1")
      ? `${baseUrl}/key`
      : `${baseUrl}/api/v1/key`;

    const response = await fetch(quotaUrl, {
      headers: { Authorization: `Bearer ${getApiKey()}` },
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
