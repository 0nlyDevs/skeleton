/**
 * Semantic search, "similar posts" and the "Pour vous" ranking.
 *
 * All three are k-nearest-neighbour searches over post embeddings, restricted
 * to a bounded candidate pool drawn with the feed's own visibility rule
 * (`homeVisibility`), so ranking can reorder what a viewer may see but never
 * widen it. The pool bound keeps every request O(pool) in memory, which is
 * plenty for a contest-scale dataset; a vector index (pgvector, Qdrant, MySQL
 * HeatWave) is the drop-in replacement past ~100k posts.
 */

import { activeEmbeddingModel, embedText } from "@/lib/ai/embeddings";
import { centroid, cosine, fromBytes, localEmbedding, toBytes, LOCAL_EMBEDDING_MODEL } from "@/lib/ai/vectors";
import { BadRequestError } from "@/lib/errors";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import type { AuthUser } from "@/types";

import type { FeedItemDto } from "../posts/posts.dto";
import { getFeedItemsByIds, homeVisibility, loadReadablePost } from "../posts/posts.service";

const SEARCH_POOL = 1_500;
const RANK_POOL = 400;
const RANK_WINDOW_DAYS = 30;
const INLINE_EMBED_BUDGET = 150;

function documentOf(post: { title: string; body: string; tags: unknown }): string {
  const tags = Array.isArray(post.tags) ? post.tags.filter((tag): tag is string => typeof tag === "string").join(" ") : "";
  return `${post.body || post.title} ${tags}`.trim();
}

/** (Re)compute one post's vector. Best-effort; called after writes. */
export async function indexPost(postId: string): Promise<void> {
  try {
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { title: true, body: true, tags: true } });
    if (!post) return;
    const { model, vector } = await embedText(documentOf(post));
    await prisma.postEmbedding.upsert({
      where: { postId },
      create: { postId, model, vector: toBytes(vector) },
      update: { model, vector: toBytes(vector) },
    });
  } catch (error) {
    logger.warn("post indexing failed", { postId, error });
  }
}

interface Candidate {
  readonly id: string;
  readonly userId: string;
  readonly createdAt: Date;
  readonly engagement: number;
  readonly vector: Float32Array;
}

/**
 * Candidates with vectors. Missing or stale vectors are filled with the local
 * model inline (microseconds each) within a budget, so a fresh install ranks
 * immediately; provider vectors arrive through `indexPost`.
 */
async function candidates(viewer: AuthUser | null, take: number, since?: Date): Promise<Candidate[]> {
  const model = activeEmbeddingModel();
  const rows = await prisma.post.findMany({
    where: { AND: [await homeVisibility(viewer), ...(since ? [{ createdAt: { gte: since } }] : [])] },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      userId: true,
      title: true,
      body: true,
      tags: true,
      createdAt: true,
      reactionCount: true,
      commentCount: true,
      shareCount: true,
      embedding: { select: { model: true, vector: true } },
    },
  });

  let budget = INLINE_EMBED_BUDGET;
  const result: Candidate[] = [];
  for (const row of rows) {
    let vector: Float32Array | null = null;
    if (row.embedding?.model === model) vector = fromBytes(row.embedding.vector);
    else if (budget > 0) {
      budget -= 1;
      vector = localEmbedding(documentOf(row));
      if (model === LOCAL_EMBEDDING_MODEL) {
        void prisma.postEmbedding
          .upsert({
            where: { postId: row.id },
            create: { postId: row.id, model, vector: toBytes(vector) },
            update: { model, vector: toBytes(vector) },
          })
          .catch(() => undefined);
      } else {
        void indexPost(row.id);
      }
    }
    if (!vector) continue;
    result.push({
      id: row.id,
      userId: row.userId,
      createdAt: row.createdAt,
      engagement: row.reactionCount + 2 * row.commentCount + 3 * row.shareCount,
      vector,
    });
  }
  return result;
}

export async function semanticSearch(q: string, viewer: AuthUser | null, limit = 10): Promise<FeedItemDto[]> {
  const query = q.trim();
  if (query.length < 2) throw new BadRequestError("Type at least 2 characters.");
  const [{ vector }, pool] = await Promise.all([embedText(query), candidates(viewer, SEARCH_POOL)]);
  const ranked = pool
    .map((candidate) => ({ id: candidate.id, score: cosine(vector, candidate.vector) }))
    .filter((entry) => entry.score > 0.12)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return getFeedItemsByIds(ranked.map((entry) => entry.id), viewer);
}

export async function similarPosts(postId: string, viewer: AuthUser | null, limit = 5): Promise<FeedItemDto[]> {
  const post = await loadReadablePost(postId, viewer);
  const vector = localEmbedding(documentOf(post));
  const pool = await candidates(viewer, SEARCH_POOL);
  const anchor = pool.find((candidate) => candidate.id === postId)?.vector ?? vector;
  const ranked = pool
    .filter((candidate) => candidate.id !== postId && candidate.id !== post.repostOfId)
    .map((candidate) => ({ id: candidate.id, score: cosine(anchor, candidate.vector) }))
    .filter((entry) => entry.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return getFeedItemsByIds(ranked.map((entry) => entry.id), viewer);
}

/** What the viewer engaged with recently: reactions, comments, own posts. */
async function interestProfile(viewer: AuthUser): Promise<Float32Array | null> {
  const since = new Date(Date.now() - 90 * 86_400_000);
  const [reacted, commented, authored] = await Promise.all([
    prisma.postReaction.findMany({ where: { userId: viewer.id, createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 60, select: { postId: true } }),
    prisma.comment.findMany({ where: { userId: viewer.id, createdAt: { gte: since }, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 40, select: { postId: true } }),
    prisma.post.findMany({ where: { userId: viewer.id, deletedAt: null, createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true } }),
  ]);
  const weights = new Map<string, number>();
  for (const row of reacted) weights.set(row.postId, (weights.get(row.postId) ?? 0) + 1);
  for (const row of commented) weights.set(row.postId, (weights.get(row.postId) ?? 0) + 2);
  for (const row of authored) weights.set(row.id, (weights.get(row.id) ?? 0) + 1.5);
  if (weights.size === 0) return null;

  const posts = await prisma.post.findMany({
    where: { id: { in: [...weights.keys()] } },
    select: { id: true, title: true, body: true, tags: true },
  });
  const vectors = posts.map((post) => localEmbedding(documentOf(post)));
  return centroid(vectors, posts.map((post) => weights.get(post.id) ?? 1));
}

const rankingCache = new Map<string, { ids: string[]; expiresAt: number }>();

/**
 * "Pour vous": KNN on the viewer's interest profile, blended with freshness,
 * engagement and a follow boost; a light per-author penalty keeps the page
 * diverse. Paged by offset over a ranking cached for a minute per viewer so
 * "load more" is stable.
 */
export async function rankForYou(
  viewer: AuthUser,
  offset: number,
  limit: number,
): Promise<{ data: FeedItemDto[]; nextCursor: string | null }> {
  let cached = rankingCache.get(viewer.id);
  if (!cached || cached.expiresAt < Date.now() || offset === 0) {
    const since = new Date(Date.now() - RANK_WINDOW_DAYS * 86_400_000);
    const [pool, profile, follows] = await Promise.all([
      candidates(viewer, RANK_POOL, since),
      interestProfile(viewer),
      prisma.follow.findMany({ where: { followerId: viewer.id }, select: { followingId: true }, take: 1_000 }),
    ]);
    const followed = new Set(follows.map((row) => row.followingId));
    const now = Date.now();
    const perAuthor = new Map<string, number>();
    const scored = pool
      .map((candidate) => {
        const ageHours = (now - candidate.createdAt.getTime()) / 3_600_000;
        const freshness = Math.exp(-ageHours / 48);
        const relevance = profile ? Math.max(0, cosine(profile, candidate.vector)) : 0;
        const engagement = Math.log1p(candidate.engagement) / 6;
        const social = followed.has(candidate.userId) ? 1 : 0;
        const own = candidate.userId === viewer.id ? -0.15 : 0;
        return { candidate, score: 0.45 * relevance + 0.3 * freshness + 0.15 * engagement + 0.1 * social + own };
      })
      .sort((a, b) => b.score - a.score)
      .map(({ candidate, score }) => {
        const seen = perAuthor.get(candidate.userId) ?? 0;
        perAuthor.set(candidate.userId, seen + 1);
        return { id: candidate.id, score: score - seen * 0.05 };
      })
      .sort((a, b) => b.score - a.score);
    cached = { ids: scored.map((entry) => entry.id), expiresAt: Date.now() + 60_000 };
    rankingCache.set(viewer.id, cached);
    if (rankingCache.size > 5_000) rankingCache.delete(rankingCache.keys().next().value as string);
  }

  const pageIds = cached.ids.slice(offset, offset + limit);
  const data = await getFeedItemsByIds(pageIds, viewer);
  const next = offset + limit < cached.ids.length ? `r:${offset + limit}` : null;
  return { data, nextCursor: next };
}
