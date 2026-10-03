"use client";

import { useRouter } from "next/navigation";

import type { OAuthAvailability } from "@/components/auth/oauth-buttons";
import type { FailedSignInDto } from "@/modules/login-protection/login-protection.stats";

import { LinkedAccounts } from "./linked-accounts";
import { PasskeysCard } from "./passkeys-card";
import { PasswordCard } from "./password-card";
import { SecurityAlert } from "./security-alert";
import { SessionsCard, type SessionInfo } from "./sessions-card";
import { DataRightsCard } from "./data-rights-card";
import { DevicesCard } from "./devices-card";
import { ProtectionSummary } from "./protection-summary";
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
  alertDeviceId = null,
  passkeys = 0,
  lockAlert = false,
  failedSignIns,
}: {
  readonly twoFactorEnabled: boolean;
  readonly hasPassword: boolean;
  readonly sessions: SessionInfo[];
  readonly currentSessionId: string;
  readonly oauth: OAuthAvailability;
  readonly alert?: boolean;
  /** F54 — the device the new-sign-in alert is about. */
  readonly alertDeviceId?: string | null;
  /** F53 — passkeys on the account, for the protection summary. */
  readonly passkeys?: number;
  /** Arrived from the "account locked" notification. */
  readonly lockAlert?: boolean;
  readonly failedSignIns: { readonly total: number; readonly items: readonly FailedSignInDto[] };
}) {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-4">
      <ProtectionSummary hasPassword={hasPassword} passkeys={passkeys} twoFactor={twoFactorEnabled} />
      {alert ? <SecurityAlert deviceId={alertDeviceId} onSecured={() => router.refresh()} /> : null}
      {lockAlert ? (
        <FailedSignInsCard {...failedSignIns} highlight twoFactorEnabled={twoFactorEnabled} />
      ) : null}
      <PasskeysCard />
      <PasswordCard hasPassword={hasPassword} onCreated={() => router.refresh()} />
      <TwoFactorCard enabled={twoFactorEnabled} hasPassword={hasPassword} />
      <LinkedAccounts availability={oauth} />
      <DevicesCard />
      <SessionsCard sessions={sessions} currentSessionId={currentSessionId} />
      {!lockAlert ? <FailedSignInsCard {...failedSignIns} highlight={false} twoFactorEnabled={twoFactorEnabled} /> : null}
      <DataRightsCard hasPassword={hasPassword} />
    </div>
  );
}

export type { SessionInfo as SecuritySessionInfo };
