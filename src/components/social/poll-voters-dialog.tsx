"use client";

import { useEffect, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { UserAvatar } from "@/components/shell/user-avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Link from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import type { PollVotersDto } from "@/modules/polls/polls.service";

/** Who voted for each option. */
export function PollVotersDialog({ postId, open, onOpenChange }: { readonly postId: string; readonly open: boolean; readonly onOpenChange: (open: boolean) => void }) {
  const t = useTranslation();
  const [data, setData] = useState<PollVotersDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setData(null);
    setError(null);
    apiFetch<{ data: PollVotersDto }>(`/api/posts/${encodeURIComponent(postId)}/poll`)
      .then((response) => !cancelled && setData(response.data))
      .catch((caught: unknown) => !cancelled && setError(describeApiError(caught, t)));
    return () => {
      cancelled = true;
    };
  }, [open, postId, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("poll.votes_title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("poll.votes_title")}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60dvh] overflow-y-auto">
          {error ? (
            <p className="py-6 text-center text-[13px] text-error">{error}</p>
          ) : data === null ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-10 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {data.options.map((option) => (
                <section key={option.id}>
                  <h3 className="mb-1 flex items-center justify-between text-[13px] font-semibold">
                    <span className="min-w-0 break-words">{option.label}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{option.voters.length}</span>
                  </h3>
                  {option.voters.length === 0 ? (
                    <p className="text-[12.5px] text-muted-foreground">{t("poll.no_votes")}</p>
                  ) : (
                    <ul className="flex flex-col">
                      {option.voters.map((voter) => (
                        <li key={voter.id}>
                          <Link
                            href={voter.username ? `/profile/${encodeURIComponent(voter.username)}` : "#"}
                            onClick={() => onOpenChange(false)}
                            className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-surface-muted"
                          >
                            <UserAvatar userId={voter.id} name={voter.name} image={voter.image} size="xs" />
                            <span className="truncate text-[13.5px]">{voter.name}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
