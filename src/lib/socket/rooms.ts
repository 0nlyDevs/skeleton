/**
 * Room naming.
 *
 * Every socket joins exactly one personal room and any number of shared rooms.
 * The personal room is what makes notifications cheap: a broadcast becomes a
 * targeted emit with no fan-out loop and no client-side filtering, so a message
 * for one user costs one packet regardless of how many users are connected.
 *
 * Names are derived from ids the server resolved, never from client input, so a
 * socket cannot join a room it was not authorised for by guessing a name (the
 * handshake validates the id and the membership check happens server-side).
 */

export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export function chatRoom(roomId: string): string {
  return `room:${roomId}`;
}

/** Room holding every connected client, for global presence announcements. */
export const GLOBAL_PRESENCE_ROOM = "presence:global";

/** Public feed: new, edited and removed published posts, plus their counters. */
export const FEED_ROOM = "feed:public";

/** One community group's live feed. Joined server-side for active members. */
export function groupRoom(groupId: string): string {
  return `group:${groupId}`;
}

/** Presence of one user, followed by whoever displays them. */
export function presenceRoom(userId: string): string {
  return `presence:${userId}`;
}

/** One post's live thread: comments and reaction counters. */
export function postRoom(postId: string): string {
  return `post:${postId}`;
}

export interface ParsedRoom {
  readonly kind: "user" | "room" | "presence" | "post";
  readonly id: string;
}

/** Parse a room name, or return `undefined` when it is not one of ours. */
export function parseRoom(name: string): ParsedRoom | undefined {
  const separator = name.indexOf(":");
  if (separator <= 0) return undefined;

  const kind = name.slice(0, separator);
  const id = name.slice(separator + 1);
  if (id.length === 0) return undefined;

  if (kind === "user") return { kind, id };
  if (kind === "room") return { kind, id };
  if (kind === "post") return { kind, id };
  if (name === GLOBAL_PRESENCE_ROOM) return { kind: "presence", id: "global" };

  return undefined;
}
