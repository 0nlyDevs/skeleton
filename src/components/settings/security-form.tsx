"use client";

import { useRouter } from "next/navigation";

import { useTranslation } from "@/components/providers/i18n-provider";

import type { OAuthAvailability } from "@/components/auth/oauth-buttons";
import type { FailedSignInDto } from "@/modules/login-protection/login-protection.stats";

import { LinkedAccounts } from "./linked-accounts";
import { PasskeysCard } from "./passkeys-card";
import { PasswordCard } from "./password-card";
import { SecurityAlert } from "./security-alert";
import { SessionsCard, type SessionInfo } from "./sessions-card";
import { DataRightsCard } from "./data-rights-card";
import { FailedSignInsCard } from "./failed-sign-ins-card";
import { TwoFactorCard } from "./two-factor-card";

/** Account & security: password, two-factor, linked providers, devices. */
export function SecurityForm({
  twoFactorEnabled,
  hasPassword,
  sessions,
  currentSessionId,
  oauth,
  alert = false,
  lockAlert = false,
  failedSignIns,
  mustSetSecret = false,
}: {
  readonly twoFactorEnabled: boolean;
  readonly hasPassword: boolean;
  readonly sessions: SessionInfo[];
  readonly currentSessionId: string;
  readonly oauth: OAuthAvailability;
  readonly alert?: boolean;
  /** Arrived from the "account locked" notification. */
  readonly lockAlert?: boolean;
  readonly failedSignIns: { readonly total: number; readonly items: readonly FailedSignInDto[] };
  /** F71 — first visit with an agent's printed access code. */
  readonly mustSetSecret?: boolean;
}) {
  const router = useRouter();
  const t = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      {mustSetSecret ? (
        <section role="status" className="flex flex-col gap-1.5 rounded-2xl border border-primary/40 bg-accent p-4">
          <h2 className="font-semibold">{t("tn.assisted.setup.title")}</h2>
          <p className="text-sm">{t("tn.assisted.setup.body")}</p>
        </section>
      ) : null}
      {alert ? <SecurityAlert onSecured={() => router.refresh()} /> : null}
      {lockAlert ? (
        <FailedSignInsCard {...failedSignIns} highlight twoFactorEnabled={twoFactorEnabled} />
      ) : null}
      <PasskeysCard />
      <PasswordCard hasPassword={hasPassword} onCreated={() => router.refresh()} />
      <TwoFactorCard enabled={twoFactorEnabled} hasPassword={hasPassword} />
      <LinkedAccounts availability={oauth} />
      <SessionsCard sessions={sessions} currentSessionId={currentSessionId} />
      {!lockAlert ? <FailedSignInsCard {...failedSignIns} highlight={false} twoFactorEnabled={twoFactorEnabled} /> : null}
      <DataRightsCard hasPassword={hasPassword} />
    </div>
  );
}

export type { SessionInfo as SecuritySessionInfo };
