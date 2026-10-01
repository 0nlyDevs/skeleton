"use client";

import { useRouter } from "next/navigation";

import type { OAuthAvailability } from "@/components/auth/oauth-buttons";

import { LinkedAccounts } from "./linked-accounts";
import { PasswordCard } from "./password-card";
import { SessionsCard, type SessionInfo } from "./sessions-card";
import { TwoFactorCard } from "./two-factor-card";

/** Account & security: password, two-factor, linked providers, devices. */
export function SecurityForm({
  twoFactorEnabled,
  hasPassword,
  sessions,
  currentSessionId,
  oauth,
}: {
  readonly twoFactorEnabled: boolean;
  readonly hasPassword: boolean;
  readonly sessions: SessionInfo[];
  readonly currentSessionId: string;
  readonly oauth: OAuthAvailability;
}) {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-4">
      <PasswordCard hasPassword={hasPassword} onCreated={() => router.refresh()} />
      <TwoFactorCard enabled={twoFactorEnabled} hasPassword={hasPassword} />
      <LinkedAccounts availability={oauth} />
      <SessionsCard sessions={sessions} currentSessionId={currentSessionId} />
    </div>
  );
}

export type { SessionInfo as SecuritySessionInfo };
