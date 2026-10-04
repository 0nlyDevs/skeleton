"use client";

import { ReplyText } from "@/components/ai/reply-text";
import { MessageCircle, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch, ApiRequestError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

interface ChatTurn {
  readonly id: number;
  readonly role: "user" | "assistant";
  readonly content: string;
  readonly cached?: boolean;
}

const HISTORY_TURNS = 6;

/**
 * AI assistant page.
 *
 * The reply is rendered as a text node — model output is data, not markup, and
 * treating it as such is the XSS half of the prompt-injection story. (The other
 * half lives server-side: the system prompt, delimiters and rate limits.)
 *
 * History sent to the API is capped to the last few turns, which keeps the request
 * — and therefore the token cost and the cache key — bounded no matter how long
 * the conversation grows in the UI.
 */
export function AiAssistant({ available }: { readonly available: boolean }) {
  const t = useTranslation();

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, pending]);

  const send = async (prompt: string) => {
    const content = prompt.trim();
    if (!content || pending) return;

    setError(null);
    setDraft("");
    setPending(true);

    const userTurn: ChatTurn = { id: nextId.current++, role: "user", content };
    setTurns((current) => [...current, userTurn]);

    try {
      const history = turns
        .slice(-HISTORY_TURNS)
        .map((turn) => ({ role: turn.role, content: turn.content }));

      const response = await apiFetch<{ data: { reply: string; cached: boolean } }>(
        "/api/ai/chat",
        { method: "POST", body: { prompt: content, history } },
      );

      setTurns((current) => [
        ...current,
        {
          id: nextId.current++,
          role: "assistant",
          content: response.data.reply,
          cached: response.data.cached,
        },
      ]);
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.isRateLimited) {
        setError("feedback.too_many");
      } else if (caught instanceof ApiRequestError && caught.code === "SERVICE_UNAVAILABLE") {
        setError("ai.disabled");
      } else {
        setError("feedback.error.body");
      }
      // Remove the optimistic user turn so the thread reflects what the server
      // actually accepted.
      setTurns((current) => current.filter((turn) => turn.id !== userTurn.id));
      setDraft(content);
    } finally {
      setPending(false);
    }
  };

  if (!available) {
    return (
      <div className="flex flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-[1.5rem] font-semibold tracking-[-0.015em]">{t("ai.title")}</h1>
          <p className="text-[0.875rem] text-muted-foreground">{t("ai.subtitle")}</p>
        </header>
        <EmptyState
          icon={Sparkles}
          title={t("ai.disabled")}
          description={t("feedback.error.body")}
        />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-10rem)] min-h-[28rem] flex-col gap-4 lg:h-[calc(100dvh-9rem)]">
      <header className="flex flex-col gap-1">
        <h1 className="text-[1.5rem] font-semibold tracking-[-0.015em]">{t("ai.title")}</h1>
        <p className="text-[0.875rem] text-muted-foreground">{t("ai.subtitle")}</p>
      </header>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {turns.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <EmptyState
                icon={MessageCircle}
                title={t("ai.empty.title")}
                description={t("ai.empty.body")}
                className="border-0 bg-transparent"
              />
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void send(t("ai.suggestion.summarize"))}
                >
                  {t("ai.suggestion.summarize")}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void send(t("ai.suggestion.tags"))}
                >
                  {t("ai.suggestion.tags")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {turns.map((turn) => (
                <div
                  key={turn.id}
                  className={cn("flex flex-col gap-1", turn.role === "user" ? "items-end" : "items-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[0.875rem] leading-relaxed",
                      turn.role === "user"
                        ? "rounded-br-md bg-primary text-primary-foreground"
                        : "rounded-bl-md bg-surface-muted text-foreground",
                    )}
                  >
                    {turn.role === "user" ? turn.content : <ReplyText text={turn.content} />}
                  </div>
                  {turn.cached ? (
                    <span className="px-1 text-[0.6562rem] uppercase tracking-wide text-muted-foreground/60">
                      {t("ai.cached")}
                    </span>
                  ) : null}
                </div>
              ))}

              {pending ? (
                <div className="flex items-center gap-2 px-1 text-[0.8125rem] italic text-muted-foreground">
                  <Spinner className="size-3.5" />
                  {t("ai.thinking")}
                </div>
              ) : null}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          className="flex items-center gap-2 border-t border-border/70 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
        >
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("ai.placeholder")}
            maxLength={4_000}
            aria-label={t("ai.placeholder")}
          />
          <Button type="submit" size="icon" disabled={pending || draft.trim().length === 0} aria-label={t("ai.send")}>
            {pending ? <Spinner className="size-4" /> : <Send />}
          </Button>
        </form>
      </Card>

      {error ? (
        <p role="alert" className="text-center text-[0.8125rem] font-medium text-error">
          {t(error as never)}
        </p>
      ) : null}
    </div>
  );
}
