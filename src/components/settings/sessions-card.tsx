"use client";

import { Loader2, Monitor } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { useFormatters } from "@/hooks/use-formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";

export interface SessionInfo {
  readonly id: string;
  readonly expiresAt: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly createdAt: string;
}

/** Devices signed in to the account; revoked by id (tokens never leave the server). */
export function SessionsCard({ sessions: initial, currentSessionId }: { readonly sessions: readonly SessionInfo[]; readonly currentSessionId: string }) {
  const t = useTranslation();
  const fmt = useFormatters();
  const [sessions, setSessions] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  const revoke = async (id: string | "*") => {
    setBusy(id);
    try {
      await apiFetch(id === "*" ? "/api/users/me/sessions" : `/api/users/me/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
      setSessions((current) => current.filter((session) => (id === "*" ? session.id === currentSessionId : session.id !== id)));
      toast.success(t("settings.security.revoked"));
    } catch (error) {
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle>{t("settings.security.sessions")}</CardTitle>
          <CardDescription>{t("settings.security.sessions_hint")}</CardDescription>
        </div>
        {sessions.length > 1 ? (
          <Button variant="secondary" size="sm" onClick={() => void revoke("*")} disabled={busy !== null}>
            {busy === "*" ? <Loader2 className="animate-spin" /> : null}
            {t("settings.security.revoke_others")}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y divide-border/60">
          {sessions.map((session) => (
            <li key={session.id} className="flex items-center gap-3 py-3">
              <Monitor className="size-4 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[0.8438rem] font-medium">{session.userAgent ?? "-"}</span>
                <span className="text-[0.75rem] text-muted-foreground">
                  {session.ipAddress ?? "-"} · {fmt.dateTime(session.createdAt)}
                </span>
              </div>
              {session.id === currentSessionId ? (
                <Badge variant="success">{t("settings.security.current")}</Badge>
              ) : (
                <Button variant="ghost" size="sm" className="text-error" disabled={busy !== null} onClick={() => void revoke(session.id)}>
                  {busy === session.id ? <Loader2 className="animate-spin" /> : null}
                  {t("settings.security.revoke")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
