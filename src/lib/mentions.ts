/**
 * `@username` mentions.
 *
 * Usernames are lowercase `[a-z0-9_.]`, so the pattern is anchored on a
 * non-handle character before the `@` (an email address is not a mention).
 * Capped so a comment stuffed with handles cannot fan out unbounded
 * notifications.
 */

export const MAX_MENTIONS = 5;

const MENTION_PATTERN = /(^|[^a-z0-9_.@])@([a-z0-9][a-z0-9_.]{1,28}[a-z0-9])(?![a-z0-9_]|\.[a-z0-9])/gi;

export function extractMentions(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(MENTION_PATTERN)) {
    const handle = match[2]?.toLowerCase();
    if (handle) found.add(handle);
    if (found.size >= MAX_MENTIONS) break;
  }
  return [...found];
}
