/**
 * Shared message limits.
 *
 * Kept in their own module so the schema, the socket handler and the client
 * counter all enforce the same number — three copies of `2000` is three chances
 * to disagree.
 */

export const MAX_MESSAGE_LENGTH = 2_000;

/** Room id of the shared room every authenticated user can read and post to. */
export const GLOBAL_ROOM_ID = "global";

export const GLOBAL_ROOM_NAME = "General";

/** How many messages a single poll may return. */
export const MAX_POLL_BATCH = 100;
