/**
 * Saved posts ("Enregistrements").
 *
 * A bookmark is private to its owner and never counted or shown to anyone
 * else. Saving requires being able to read the post; listing re-applies the
 * viewer's current visibility, so a post that became private, was removed, or
 * belongs to a group the user left silently drops out of the list.
 */

import { RATE_LIMITS, enforceThenRecord, rateLimitKey } from "@/lib/rate-limit";
import type { AuthUser } from "@/types";

import { getFeedItemsByIds, loadReadablePost, type FeedPage } from "../posts/posts.service";
import { deleteBookmark, findBookmarkPage, saveBookmark } from "./bookmarks.repository";

export async function savePost(postId: string, actor: AuthUser): Promise<{ saved: true }> {
  await loadReadablePost(postId, actor);
  await enforceThenRecord([{ key: rateLimitKey("bookmark", actor.id), rule: RATE_LIMITS.reaction }]);
  await saveBookmark(actor.id, postId);
  return { saved: true };
}

export async function unsavePost(postId: string, actor: AuthUser): Promise<{ saved: false }> {
  await deleteBookmark(actor.id, postId);
  return { saved: false };
}

function encodeCursor(row: { createdAt: Date; postId: string }): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.postId}`, "utf8").toString("base64url");
}

function decodeCursor(cursor: string | undefined): { createdAt: Date; postId: string } | null {
  if (!cursor) return null;
  const [iso, postId] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  const createdAt = new Date(iso ?? "");
  return postId && !Number.isNaN(createdAt.getTime()) ? { createdAt, postId } : null;
}

export async function listSavedPosts(actor: AuthUser, query: { cursor?: string | undefined; limit: number }): Promise<FeedPage> {
  const rows = await findBookmarkPage(actor.id, decodeCursor(query.cursor), query.limit + 1);
  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  return {
    data: await getFeedItemsByIds(
      page.map((row) => row.postId),
      actor,
    ),
    nextCursor: rows.length > query.limit && last ? encodeCursor(last) : null,
  };
}
