"use client";

import Link from "@/components/ui/link";

import { useTranslation } from "@/components/providers/i18n-provider";
import { useFormatters } from "@/hooks/use-formatters";
import { UserAvatar } from "@/components/shell/user-avatar";
import type { RepostedPostDto } from "@/modules/posts/posts.dto";

import { MediaGrid } from "./media-grid";
import { RichText } from "./rich-text";

/** The original inside a share, framed so it reads as quoted content. */
export function RepostEmbed({ original }: { readonly original: RepostedPostDto }) {
  const t = useTranslation();
  const fmt = useFormatters();
  if (!original.available || !original.author) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[0.8125rem] text-muted-foreground">
        {t("share.unavailable")}
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-border/80">
      {original.media.length > 0 ? <MediaGrid media={original.media} /> : null}
      <div className="flex flex-col gap-2 p-3">
        <Link href={`/feed/${original.id}`} className="flex items-center gap-2.5">
          <UserAvatar userId={original.author.id} name={original.author.name} image={original.author.image} size="xs" />
          <span className="min-w-0">
            <span className="block truncate text-[0.8438rem] font-semibold">{original.author.name}</span>
            {original.createdAt ? <span className="block text-[0.7188rem] text-muted-foreground">{fmt.relative(original.createdAt)}</span> : null}
          </span>
        </Link>
        {original.body ? (
          <RichText text={original.body} mentions={original.mentions} className="line-clamp-6 whitespace-pre-line break-words text-[0.875rem] leading-relaxed" />
        ) : null}
      </div>
    </div>
  );
}
