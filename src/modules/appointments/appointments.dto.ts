import type { Prisma } from "@/generated/prisma/client";
import { decryptField } from "@/lib/crypto/field-encryption";

import { durationMinutes } from "./appointments.time";

export const appointmentInclude = {
  agent: { select: { id: true, name: true, firstName: true } },
  citizen: { select: { id: true, name: true, username: true } },
  service: { select: { slug: true, name: true, howTo: true } },
} as const;

export type AppointmentRow = Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>;

export interface AppointmentDto {
  readonly reference: string;
  readonly status: "BOOKED" | "CANCELLED" | "DONE" | "MISSED";
  readonly startsAt: string;
  readonly endsAt: string;
  readonly durationMinutes: number;
  readonly mode: "IN_PERSON" | "PHONE";
  readonly location: string | null;
  readonly service: { readonly slug: string; readonly name: string } | null;
  /** The resident sees the agent's first name only. */
  readonly agent: { readonly id: string; readonly name: string };
  /** Shown to staff; the resident already knows who they are. */
  readonly citizen: { readonly id: string; readonly name: string; readonly username: string | null };
  readonly reason: string;
  readonly remindDayBefore: boolean;
  readonly remindHourBefore: boolean;
  readonly roomId: string | null;
  readonly cancelledAt: string | null;
  readonly cancelReason: string | null;
  /** Still ahead and booked: it can be cancelled. */
  readonly upcoming: boolean;
  /** Its start time has passed: the agent can close it. */
  readonly started: boolean;
}

export function toAppointmentDto(row: AppointmentRow, viewerIsStaff: boolean, now: Date = new Date()): AppointmentDto {
  let reason = "";
  try {
    reason = decryptField(row.reasonEncrypted);
  } catch {
    reason = "";
  }
  return {
    reference: row.reference,
    status: row.status,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    durationMinutes: durationMinutes(row.startsAt, row.endsAt),
    mode: row.mode,
    location: row.location,
    service: row.service ? { slug: row.service.slug, name: row.service.name } : null,
    agent: { id: row.agent.id, name: viewerIsStaff ? row.agent.name : (row.agent.firstName ?? row.agent.name.split(" ")[0] ?? row.agent.name) },
    citizen: { id: row.citizen.id, name: row.citizen.name, username: row.citizen.username },
    reason,
    remindDayBefore: row.remindDayBefore,
    remindHourBefore: row.remindHourBefore,
    roomId: row.roomId,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancelReason: row.cancelReason,
    upcoming: row.status === "BOOKED" && row.startsAt.getTime() > now.getTime(),
    started: row.startsAt.getTime() <= now.getTime(),
  };
}

export interface FreeSlotDto {
  readonly id: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly durationMinutes: number;
  readonly mode: "IN_PERSON" | "PHONE";
  readonly location: string | null;
  readonly service: { readonly slug: string; readonly name: string } | null;
  readonly agentName: string;
}

export interface AgentSlotDto {
  readonly id: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly mode: "IN_PERSON" | "PHONE";
  readonly location: string | null;
  readonly service: { readonly slug: string; readonly name: string } | null;
  /** The booking on it, if any. */
  readonly booking: { readonly reference: string; readonly citizenName: string } | null;
}
