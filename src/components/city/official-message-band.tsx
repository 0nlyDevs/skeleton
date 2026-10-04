"use client";

import { ArrowRight, Check, Landmark } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useI18n, useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { useSocket } from "@/hooks/use-socket";
import { apiFetch } from "@/lib/api/client";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { SOCKET_EVENTS } from "@/lib/socket/events";
import type { OfficialMessageDto } from "@/modules/official-messages/official-messages.service";

const READ_KEY = "bubble-official-read";
/** Visitors without a live connection still see a new message within a minute. */
const POLL_MS = 60_000;

function readId(): string | null {
  try {
    return window.localStorage.getItem(READ_KEY);
  } catch {
    return null;
  }
}

/**
 * F73 — the High Council's official message, hanging from the top of every
 * screen: what to know, what to do, one way to act. It arrives the moment it
 * is published and stays until the reader confirms having read it, it
 * expires, or the Council withdraws it. It never blocks the page.
 */
export function OfficialMessageBand() {
  const t = useTranslation();
  const { locale } = useI18n();
  const { socket } = useSocket();
  const [message, setMessage] = useState<OfficialMessageDto | null>(null);
  const [read, setRead] = useState<string | null>(null);
  const [fresh, setFresh] = useState(false);

  const load = useCallback(async (pushed: boolean) => {
    try {
      const { data } = await apiFetch<{ data: OfficialMessageDto | null }>("/api/official-messages?view=current");
      setRead(readId());
      setMessage(data);
      if (pushed) setFresh(true);
    } catch {
      // Offline or overloaded: keep what is on screen.
    }
  }, []);

  useEffect(() => {
    void load(false);
    // With the live connection up, a published message arrives by itself: no polling at all.
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !socket?.connected) void load(false);
    }, document.documentElement.hasAttribute("data-eco") ? POLL_MS * 3 : POLL_MS);
    return () => window.clearInterval(timer);
  }, [load, socket]);

  useEffect(() => {
    if (!socket) return;
    const onChange = () => void load(true);
    socket.on(SOCKET_EVENTS.officialMessageUpdated, onChange);
    return () => {
      socket.off(SOCKET_EVENTS.officialMessageUpdated, onChange);
    };
  }, [socket, load]);

  if (!message || message.state !== "ACTIVE" || read === message.id) return null;

  const confirm = () => {
    try {
      window.localStorage.setItem(READ_KEY, message.id);
    } catch {
      // Private mode: the message comes back on the next page, which is safe.
    }
    setRead(message.id);
  };

  return (
    <div className="relative z-[70] flex justify-center bg-card px-3">
      <section
        role={fresh ? "alert" : "status"}
        aria-labelledby="official-title"
        className="flex w-full max-w-[1180px] flex-col gap-2 px-1 pb-3 pt-3 sm:px-3"
      >
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.75rem] font-semibold text-primary">
          <Landmark className="size-3.5" aria-hidden />
          {t("tn.official.label")}
          <span className="font-normal text-muted-foreground">· {formatRelative(message.publishedAt, locale)}</span>
        </p>
        <h2 id="official-title" className="text-[1.0625rem] font-semibold leading-snug">
          {message.title}
        </h2>
        <p className="text-[0.9062rem] leading-relaxed">{message.body}</p>
        {message.action ? (
          <p className="rounded-xl bg-surface-muted px-3 py-2 text-[0.9062rem]">
            <span className="font-semibold">{t("tn.official.todo")} </span>
            {message.action}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <p className="text-[0.75rem] text-muted-foreground">
            {message.expiresAt ? t("tn.official.until", { date: formatDateTime(message.expiresAt, locale) }) : t("tn.official.until_withdrawn")}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {message.linkHref ? (
              <Button asChild size="sm" variant="secondary" onClick={confirm}>
                <Link href={message.linkHref}>
                  {t(`tn.official.link.${message.linkHref.slice(1)}` as MessageKey)}
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            ) : null}
            <Button size="sm" onClick={confirm}>
              <Check aria-hidden />
              {t("tn.official.read")}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
