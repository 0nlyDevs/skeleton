import Link from "next/link";
import { Fragment } from "react";

import type { MentionDto } from "@/modules/mentions/mentions.service";

const TOKEN = /(@[a-z0-9][a-z0-9_.]{1,28}[a-z0-9])|(https?:\/\/[^\s<>"']{2,300})/gi;

/**
 * User text, rendered safely: plain text nodes only (React escapes them), with
 * two kinds of links: `@handle` when — and only when — the server stored that
 * handle as a mention, and http(s) URLs opened with `noopener noreferrer`.
 * No HTML is ever interpreted.
 */
export function RichText({
  text,
  mentions,
  className,
}: {
  readonly text: string;
  readonly mentions: readonly MentionDto[];
  readonly className?: string;
}) {
  const known = new Set(mentions.map((mention) => mention.username.toLowerCase()));
  const parts: React.ReactNode[] = [];
  let last = 0;

  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(text.slice(last, index));
    const [token] = match;
    if (match[1]) {
      const handle = token.slice(1).toLowerCase();
      parts.push(
        known.has(handle) ? (
          <Link key={index} href={`/profile/${encodeURIComponent(handle)}`} className="font-semibold text-primary hover:underline">
            {token}
          </Link>
        ) : (
          token
        ),
      );
    } else {
      parts.push(
        <a key={index} href={token} target="_blank" rel="noopener noreferrer nofollow ugc" className="break-all text-primary hover:underline">
          {token}
        </a>,
      );
    }
    last = index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));

  return (
    <p className={className}>
      {parts.map((part, index) => (
        <Fragment key={index}>{part}</Fragment>
      ))}
    </p>
  );
}
