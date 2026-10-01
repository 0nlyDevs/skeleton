"use client";

import { Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";
import type { FeedItemDto } from "@/modules/posts/posts.dto";
import type { AuthUser } from "@/types";

export function FeedComposer({
  user,
  onPublished,
}: {
  readonly user: AuthUser;
  readonly onPublished: (post: FeedItemDto) => void;
}) {
  const t = useTranslation();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (title.trim().length < 1 || body.trim().length < 20 || busy) return;
    setBusy(true);
    try {
      const created = await apiFetch<{ data: { id: string } }>("/api/posts", {
        method: "POST",
        body: { title: title.trim(), body: body.trim(), published: true, tags: [] },
      });
      const response = await apiFetch<{ data: FeedItemDto }>(`/api/feed/${encodeURIComponent(created.data.id)}`);
      onPublished(response.data);
      setTitle("");
      setBody("");
      toast.success(t("feed.composer.published"));
    } catch {
      toast.error(t("feedback.error.body"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4 sm:p-5">
      <form onSubmit={(event) => void submit(event)} className="flex items-start gap-3">
        <Avatar className="mt-1 size-9 shrink-0">
          {user.image ? <AvatarImage src={user.image} alt="" /> : null}
          <AvatarFallback>{user.name.slice(0, 1).toLocaleUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t("feed.composer.title_placeholder")}
            aria-label={t("feed.composer.title_placeholder")}
            maxLength={140}
            required
          />
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={t("feed.composer.placeholder", { name: user.name })}
            aria-label={t("feed.composer.placeholder", { name: user.name })}
            minLength={20}
            maxLength={20_000}
            required
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{body.length}/20000</span>
            <Button type="submit" disabled={busy || title.trim().length === 0 || body.trim().length < 20}>
              <Send />{busy ? t("common.saving") : t("feed.composer.publish")}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}
