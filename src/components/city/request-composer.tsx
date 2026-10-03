"use client";

import { Loader2, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import type { CityRequestDto } from "@/modules/city-requests/city-requests.dto";

/** Reply box under a request; agents can switch it to an internal note. */
export function RequestComposer({
  reference,
  allowInternal,
  onSent,
}: {
  readonly reference: string;
  readonly allowInternal: boolean;
  readonly onSent: (request: CityRequestDto) => void;
}) {
  const t = useTranslation();
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      const response = await apiFetch<{ data: CityRequestDto }>(`/api/city-requests/${reference}/messages`, {
        method: "POST",
        body: { body: body.trim(), internal: allowInternal && internal },
      });
      setBody("");
      onSent(response.data);
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-2 rounded-2xl border bg-card p-3 shadow-panel", internal ? "border-warning/60" : "border-border/70")}>
      <label htmlFor="request-reply" className="sr-only">{t("tn.request.reply")}</label>
      <Textarea
        id="request-reply"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={t("tn.request.reply_placeholder")}
        rows={3}
        maxLength={5000}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void send();
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {allowInternal ? (
          <label className="flex items-center gap-2 text-[0.8125rem]">
            <Switch checked={internal} onCheckedChange={setInternal} />
            {t("tn.request.internal")}
          </label>
        ) : (
          <span />
        )}
        <Button size="sm" onClick={() => void send()} disabled={busy || !body.trim()}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          {t("tn.request.send")}
        </Button>
      </div>
    </div>
  );
}
