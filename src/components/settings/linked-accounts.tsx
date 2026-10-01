"use client";

import { Link2 } from "lucide-react";
import { useEffect, useState } from "react";

import { hasAnyOAuth, type OAuthAvailability, type OAuthProvider } from "@/components/auth/oauth-buttons";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth/client";

const LABELS: Record<OAuthProvider, string> = { google: "Google", github: "GitHub" };

/**
 * Link an external provider to the signed-in account.
 *
 * Linking from here is the safe path for an address that already has a
 * password account: the user proves ownership by being signed in, instead of
 * relying on the provider to vouch for the email.
 */
export function LinkedAccounts({ availability }: { readonly availability: OAuthAvailability }) {
  const t = useTranslation();
  const [linked, setLinked] = useState<ReadonlySet<string> | null>(null);
  const [pending, setPending] = useState<OAuthProvider | null>(null);

  useEffect(() => {
    let cancelled = false;
    void authClient.listAccounts().then((result) => {
      if (cancelled) return;
      setLinked(new Set((result.data ?? []).map((account) => account.providerId)));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!hasAnyOAuth(availability)) return null;

  const providers = (Object.keys(LABELS) as OAuthProvider[]).filter((provider) => availability[provider]);

  const link = async (provider: OAuthProvider) => {
    setPending(provider);
    const result = await authClient.linkSocial({
      provider,
      callbackURL: "/settings/security",
      errorCallbackURL: "/settings/security",
    });
    if (result.error) setPending(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="size-4 text-muted-foreground" />
          {t("settings.security.linked")}
        </CardTitle>
        <p className="text-[13px] text-muted-foreground">{t("settings.security.linked_hint")}</p>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y divide-border/70">
          {providers.map((provider) => (
            <li key={provider} className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-[14px] font-medium">{LABELS[provider]}</span>
              {linked === null ? (
                <Spinner className="size-4" />
              ) : linked.has(provider) ? (
                <Badge variant="success">{t("settings.security.linked_on")}</Badge>
              ) : (
                <Button size="sm" variant="secondary" disabled={pending !== null} onClick={() => void link(provider)}>
                  {pending === provider ? <Spinner className="size-3.5" /> : null}
                  {t("settings.security.link")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
