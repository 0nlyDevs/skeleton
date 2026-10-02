/**
 * Text → vector. Uses the configured provider's OpenAI-compatible
 * `/embeddings` endpoint when `AI_EMBEDDING_MODEL` is set (with a hard
 * timeout), and the local hashing embedding otherwise or on any failure, so
 * search and ranking never depend on a third party being up.
 */

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

import { LOCAL_EMBEDDING_MODEL, localEmbedding, normalize } from "./vectors";

export interface Embedding {
  readonly model: string;
  readonly vector: Float32Array;
}

export function activeEmbeddingModel(): string {
  return env.AI_EMBEDDING_MODEL && env.aiEnabled ? env.AI_EMBEDDING_MODEL : LOCAL_EMBEDDING_MODEL;
}

export async function embedText(text: string): Promise<Embedding> {
  const input = text.slice(0, 8_000);
  const model = activeEmbeddingModel();
  if (model === LOCAL_EMBEDDING_MODEL) return { model, vector: localEmbedding(input) };

  try {
    const response = await fetch(`${env.AI_BASE_URL}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.AI_API_KEY ?? process.env.OPENROUTER_API_KEY ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, input }),
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`embeddings responded ${response.status}`);
    const data = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
    const values = data.data?.[0]?.embedding;
    if (!values?.length) throw new Error("empty embedding");
    return { model, vector: normalize(Float32Array.from(values)) };
  } catch (error) {
    // Falling back changes the model tag, so the two kinds never mix.
    logger.warn("provider embedding failed; using local embedding", { error });
    return { model: LOCAL_EMBEDDING_MODEL, vector: localEmbedding(input) };
  }
}
