"use client";

import { Loader2, MessageCircleQuestion } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";

interface PlainResult {
  readonly lines: string[];
  readonly usedAi: boolean;
}

/**
 * F89/F90 — "Expliquer plus simplement": under a hard passage, one button
 * asks for a plain-language version of just that passage. The official text
 * stays where it is; nothing else on the page changes.
 */
export function PlainExplain({ text, className }: { readonly text: string; readonly className?: string }) {
  const t = useTranslation();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<PlainResult | null>(null);
  const [message, setMessage] = useState("");

  if (text.trim().length < 10) return null;

  const ask = async () => {
    setState("loading");
    try {
      const { data } = await apiFetch<{ data: PlainResult }>("/api/plain", { method: "POST", body: { text } });
      setResult(data);
      setState("done");
    } catch (error) {
      setMessage(describeApiError(error, t));
      setState("error");
    }
  };

  return (
    <div className={className}>
      {state === "done" && result ? (
        <div className="rounded-2xl bg-surface-muted p-4" role="region" aria-label={t("tn.plain.title")}>
          <p className="mb-2 text-[0.8125rem] font-semibold">{t("tn.plain.title")}</p>
          <ul className="flex flex-col gap-1.5 text-[0.9375rem]">
            {result.lines.map((line, index) => (
              <li key={index} className="flex gap-2">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground/60" />
                {line}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[0.75rem] text-muted-foreground">{t("tn.plain.note")}</p>
        </div>
      ) : (
        <>
          <button type="button" onClick={() => void ask()} disabled={state === "loading"} className="inline-flex items-center gap-2 rounded-full bg-surface-muted px-4 py-2 text-[0.875rem] font-medium hover:bg-accent disabled:opacity-60">
            {state === "loading" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <MessageCircleQuestion className="size-4" aria-hidden />}
            {t("tn.plain.button")}
          </button>
          {state === "error" ? <p role="alert" className="mt-2 text-[0.8125rem] text-error">{message}</p> : null}
        </>
      )}
    </div>
  );
}
