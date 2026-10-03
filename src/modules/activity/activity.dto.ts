import type { Role } from "@/types";

/** One line of the agents' history: who did what, on what, when. */
export interface ActivityEntryDto {
  readonly id: string;
  readonly action: string;
  readonly category: string;
  /** What kind of change (create, update, publish, close…), from the audit metadata. */
  readonly op: string | null;
  readonly actor: { readonly id: string; readonly name: string; readonly role: Role } | null;
  readonly target: { readonly type: string; readonly id: string; readonly label: string | null; readonly href: string | null } | null;
  /** Readable details (changes, reason, from → to). Never IPs or secrets. */
  readonly details: Record<string, unknown>;
  readonly createdAt: string;
}
