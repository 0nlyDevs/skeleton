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
<<<<<<< HEAD
    <div className="relative z-[70] flex justify-center official-band border-b-4 border-bead px-3">
      <section
        role={fresh ? "alert" : "status"}
        aria-labelledby="official-title"
        className="flex w-full max-w-[1480px] flex-col gap-x-4 gap-y-2 px-1 py-2.5 sm:px-3 lg:flex-row lg:items-center"
=======
    <div className="relative z-[70] flex justify-center bg-card px-3">
      <section
        role={fresh ? "alert" : "status"}
        aria-labelledby="official-title"
        className="flex w-full max-w-[1180px] flex-col gap-2 px-1 pb-3 pt-3 sm:px-3"
<<<<<<< HEAD
>>>>>>> 0b9a35c (feat: put the landing's island on the city map, ask the district at sign-up, drop emoji, say real error reasons and fix people search)
=======
>>>>>>> c7515a0 (feat: put the landing's island on the city map, ask the district at sign-up, drop emoji, say real error reasons and fix people search)
>>>>>>> 763c828 (feat: put the landing's island on the city map, ask the district at sign-up, drop emoji, say real error reasons and fix people search)
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground max-lg:hidden">
          <Landmark className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-primary">
            {t("tn.official.label")}
            <span className="font-normal normal-case tracking-normal text-muted-foreground">
              · {formatRelative(message.publishedAt, locale)} · {message.expiresAt ? t("tn.official.until", { date: formatDateTime(message.expiresAt, locale) }) : t("tn.official.until_withdrawn")}
            </span>
          </p>
          <h2 id="official-title" className="text-[1rem] font-semibold leading-snug">
            {message.title}
          </h2>
          <p className="text-[0.875rem] leading-snug">
            {message.body}
            {message.action ? (
              <>
                {" "}
                <span className="font-semibold">
                  {t("tn.official.todo")} {message.action}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
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
      </section>
    </div>
  );
}
