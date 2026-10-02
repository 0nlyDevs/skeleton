/**
 * Vector maths and the local embedding.
 *
 * The local embedding is a feature-hashing model: accent-folded unigrams and
 * bigrams, hashed (FNV-1a) into 384 signed buckets with log term weights, then
 * L2-normalised. It needs no model download and no network, captures topical
 * overlap well enough for "similar posts" and ranking, and gives the skeleton
 * semantic features even when no AI provider is configured. A provider
 * embedding replaces it transparently when `AI_EMBEDDING_MODEL` is set.
 */

export const LOCAL_EMBEDDING_MODEL = "local-hash-v1";
const DIMENSIONS = 384;

const STOPWORDS = new Set(
  (
    "a an and are as at be but by for from has have i in is it its of on or that the this to was were will with you your " +
    "au aux avec ce ces dans de des du elle en et eux il ils je la le les leur lui ma mais me mes moi mon ne nos notre nous on ou " +
    "par pas pour qu que qui sa se ses son sur ta te tes toi ton tu un une vos votre vous c d j l n s t y est sont ai as a"
  ).split(" "),
);

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function tokenize(text: string): string[] {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .split(/[^a-z0-9#@]+/)
    .map((token) => token.replace(/^[#@]/, ""))
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

export function normalize(vector: Float32Array): Float32Array {
  let norm = 0;
  for (const value of vector) norm += value * value;
  norm = Math.sqrt(norm);
  if (norm === 0) return vector;
  for (let index = 0; index < vector.length; index += 1) vector[index] = (vector[index] ?? 0) / norm;
  return vector;
}

export function localEmbedding(text: string): Float32Array {
  const vector = new Float32Array(DIMENSIONS);
  const tokens = tokenize(text);
  const counts = new Map<string, number>();
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] as string;
    counts.set(token, (counts.get(token) ?? 0) + 1);
    // Light morphology: a 5-char prefix groups "voyage/voyager/voyages".
    if (token.length > 6) counts.set(`~${token.slice(0, 5)}`, (counts.get(`~${token.slice(0, 5)}`) ?? 0) + 0.5);
    const next = tokens[index + 1];
    if (next) counts.set(`${token}_${next}`, (counts.get(`${token}_${next}`) ?? 0) + 0.7);
  }
  for (const [feature, count] of counts) {
    const hash = fnv1a(feature);
    const bucket = hash % DIMENSIONS;
    const sign = (hash >>> 31) === 0 ? 1 : -1;
    vector[bucket] = (vector[bucket] ?? 0) + sign * (1 + Math.log(count));
  }
  return normalize(vector);
}

export function cosine(left: Float32Array, right: Float32Array): number {
  if (left.length !== right.length) return 0;
  let dot = 0;
  for (let index = 0; index < left.length; index += 1) dot += (left[index] ?? 0) * (right[index] ?? 0);
  return dot;
}

export function toBytes(vector: Float32Array): Uint8Array<ArrayBuffer> {
  const copy = new Float32Array(vector);
  return new Uint8Array(copy.buffer);
}

export function fromBytes(bytes: Uint8Array): Float32Array {
  const aligned = new Uint8Array(bytes);
  return new Float32Array(aligned.buffer, 0, Math.floor(aligned.byteLength / 4));
}

/** Mean of several unit vectors, re-normalised (an "interest" profile). */
export function centroid(vectors: readonly Float32Array[], weights?: readonly number[]): Float32Array | null {
  const first = vectors[0];
  if (!first) return null;
  const sum = new Float32Array(first.length);
  vectors.forEach((vector, row) => {
    const weight = weights?.[row] ?? 1;
    for (let index = 0; index < sum.length; index += 1) sum[index] = (sum[index] ?? 0) + (vector[index] ?? 0) * weight;
  });
  return normalize(sum);
}
