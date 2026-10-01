/**
 * The assistant's tools: explicit, read-only, scoped to the caller.
 *
 * The model never touches the database. Each tool is a thin adapter over the
 * same service functions the API uses, called *as the signed-in user*, so the
 * assistant can only ever see what that user could open in the app: drafts,
 * removed posts, private groups and other people's messages stay out exactly
 * as they do in the UI. There is deliberately no tool for direct messages.
 *
 * Arguments are validated with Zod and clamped; results are reduced to the
 * fields an answer needs, with text truncated, before going back to the model.
 */

import { z } from "zod";

import type { ToolDefinition } from "@/lib/ai/prompts";
import { idSchema } from "@/lib/validate";
import type { AuthUser } from "@/types";

import { listComments } from "../comments/comments.service";
import { getFollowingIds } from "../follows/follows.service";
import { listGroups } from "../groups/groups.service";
import { listNotifications } from "../notifications/notifications.service";
import type { FeedItemDto } from "../posts/posts.dto";
import { getFeedItem, listFeed } from "../posts/posts.service";
import { semanticSearch } from "../recommendations/recommendations.service";

const MAX_TEXT = 1_200;

function clip(value: string, max = MAX_TEXT): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function describePost(post: FeedItemDto) {
  return {
    id: post.id,
    url: `/feed/${post.id}`,
    author: post.author.username ? `${post.author.name} (@${post.author.username})` : post.author.name,
    group: post.group ? `${post.group.name} (${post.group.privacy.toLowerCase()})` : null,
    created_at: post.createdAt,
    edited: post.editedAt !== null,
    text: clip(post.body),
    images: post.media.length,
    reactions: post.reactionCount,
    comments: post.commentCount,
  };
}

export const AI_TOOLS: readonly ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "list_recent_posts",
      description:
        "Newest posts the user can see on Skeleton. Use for 'latest post', 'what did people post today', 'what is new'. " +
        "scope=home is everyone + the user's groups; scope=following is only people the user follows.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 10, default: 5 },
          scope: { type: "string", enum: ["home", "following"], default: "home" },
          since_hours: { type: "integer", minimum: 1, maximum: 720, description: "Only posts newer than this." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_posts",
      description: "Search posts the user can see by keyword in their text.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", maxLength: 80 },
          limit: { type: "integer", minimum: 1, maximum: 10, default: 5 },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_posts_by_meaning",
      description:
        "Semantic search: posts about a topic even when they use other words (e.g. 'vacances' finds beach photos). Prefer this for 'what are people saying about X'.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", maxLength: 200 },
          limit: { type: "integer", minimum: 1, maximum: 10, default: 5 },
        },
        required: ["topic"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_post",
      description: "One post with its first comments, by id (ids come from other tools or /feed/<id> links).",
      parameters: {
        type: "object",
        properties: { post_id: { type: "string" } },
        required: ["post_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_group_posts",
      description: "Recent posts of one community group, by its slug. Fails if the user cannot see that group.",
      parameters: {
        type: "object",
        properties: {
          group_slug: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 10, default: 5 },
        },
        required: ["group_slug"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_my_groups",
      description: "Community groups the user belongs to (names and slugs).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_my_notifications",
      description: "The user's own most recent notifications (mentions, comments, reactions, messages).",
      parameters: {
        type: "object",
        properties: { limit: { type: "integer", minimum: 1, maximum: 15, default: 8 } },
      },
    },
  },
];

const limitField = (max: number, fallback: number) => z.coerce.number().int().min(1).max(max).catch(fallback);

const schemas = {
  list_recent_posts: z.object({
    limit: limitField(10, 5),
    scope: z.enum(["home", "following"]).catch("home"),
    since_hours: z.coerce.number().int().min(1).max(720).optional().catch(undefined),
  }),
  search_posts: z.object({ query: z.string().trim().min(1).max(80), limit: limitField(10, 5) }),
  get_post: z.object({ post_id: idSchema }),
  search_posts_by_meaning: z.object({ topic: z.string().trim().min(2).max(200), limit: limitField(10, 5) }),
  list_group_posts: z.object({
    group_slug: z.string().trim().toLowerCase().max(60).regex(/^[a-z0-9-]+$/),
    limit: limitField(10, 5),
  }),
  list_my_groups: z.object({}),
  list_my_notifications: z.object({ limit: limitField(15, 8) }),
} as const;

/** Run one tool as `actor`. Every access check is the service's own. */
export function createToolExecutor(actor: AuthUser) {
  return async (name: string, rawArgs: unknown): Promise<unknown> => {
    switch (name) {
      case "list_recent_posts": {
        const args = schemas.list_recent_posts.parse(rawArgs ?? {});
        const following = args.scope === "following" ? await getFollowingIds(actor.id) : undefined;
        const page = await listFeed({ limit: 10, scope: args.scope === "following" ? "following" : "all" }, actor, following);
        const cutoff = args.since_hours ? Date.now() - args.since_hours * 3_600_000 : 0;
        const posts = page.data.filter((post) => Date.parse(post.createdAt) >= cutoff).slice(0, args.limit);
        return { now: new Date().toISOString(), posts: posts.map(describePost) };
      }
      case "search_posts": {
        const args = schemas.search_posts.parse(rawArgs ?? {});
        const page = await listFeed({ limit: args.limit, q: args.query, scope: "all" }, actor);
        return { posts: page.data.map(describePost) };
      }
      case "search_posts_by_meaning": {
        const args = schemas.search_posts_by_meaning.parse(rawArgs ?? {});
        const posts = await semanticSearch(args.topic, actor, args.limit);
        return { posts: posts.map(describePost) };
      }
      case "get_post": {
        const args = schemas.get_post.parse(rawArgs ?? {});
        const post = await getFeedItem(args.post_id, actor);
        const comments = await listComments(args.post_id, { limit: 8 }, actor);
        return {
          post: describePost(post),
          comments: comments.data
            .filter((comment) => !comment.deleted)
            .map((comment) => ({
              author: comment.author?.name ?? "unknown",
              text: clip(comment.body, 300),
              replies: comment.replies.length,
            })),
        };
      }
      case "list_group_posts": {
        const args = schemas.list_group_posts.parse(rawArgs ?? {});
        const page = await listFeed({ limit: args.limit, groupSlug: args.group_slug, scope: "all" }, actor);
        return { posts: page.data.map(describePost) };
      }
      case "list_my_groups": {
        const groups = await listGroups({ scope: "mine", limit: 30 }, actor);
        return { groups: groups.map((group) => ({ name: group.name, slug: group.slug, members: group.memberCount })) };
      }
      case "list_my_notifications": {
        const args = schemas.list_my_notifications.parse(rawArgs ?? {});
        const page = await listNotifications(actor.id, { page: 1, limit: args.limit });
        return {
          notifications: page.data.map((item) => ({
            type: item.type,
            title: clip(item.title, 160),
            read: item.read,
            at: item.createdAt,
          })),
        };
      }
      default:
        throw new Error(`Unknown tool "${name}".`);
    }
  };
}
