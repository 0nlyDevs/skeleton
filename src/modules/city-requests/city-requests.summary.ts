/**
 * F56 — a resident's summary of their requests, readable on screen, printed
 * or saved as PDF, and as CSV for a spreadsheet: where each request stands,
 * what happened last and what the city answered, plus a few totals. Only the
 * resident's own requests, never internal notes.
 */

import { prisma } from "@/lib/db/prisma";
import type { AuthUser } from "@/types";

import { decryptBody } from "./city-requests.dto";

export type SummaryFilter = "all" | "open" | "done";

export interface RequestSummaryRow {
  readonly reference: string;
  readonly subject: string;
  readonly service: string | null;
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly closedAt: string | null;
  /** The city's latest public answer, shortened. */
  readonly lastReply: { readonly body: string; readonly at: string } | null;
  readonly waitingForYou: boolean;
  /** Days from sending to resolution, for finished requests. */
  readonly handledInDays: number | null;
}

export interface RequestSummary {
  readonly generatedAt: string;
  readonly resident: { readonly name: string };
  readonly filter: SummaryFilter;
  readonly totals: { readonly all: number; readonly open: number; readonly waitingForYou: number; readonly done: number; readonly averageDays: number | null };
  readonly rows: readonly RequestSummaryRow[];
}

const OPEN = ["NEW", "IN_PROGRESS", "WAITING_CITIZEN"] as const;
const DONE = ["RESOLVED", "CLOSED"] as const;

export async function buildRequestSummary(actor: AuthUser, filter: SummaryFilter): Promise<RequestSummary> {
  const rows = await prisma.cityRequest.findMany({
    where: { citizenId: actor.id },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      service: { select: { name: true } },
      messages: { where: { internal: false, NOT: { authorId: actor.id } }, orderBy: { createdAt: "desc" }, take: 1, select: { body: true, createdAt: true } },
    },
  });

  const all = rows.map((row): RequestSummaryRow => {
    const reply = row.messages[0];
    const finished = (DONE as readonly string[]).includes(row.status);
    const end = row.closedAt ?? (finished ? row.updatedAt : null);
    const body = reply ? decryptBody(reply.body) : null;
    return {
      reference: row.reference,
      subject: row.subject,
      service: row.service?.name ?? null,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      closedAt: row.closedAt?.toISOString() ?? null,
      lastReply: reply && body ? { body: body.length > 280 ? `${body.slice(0, 277)}…` : body, at: reply.createdAt.toISOString() } : null,
      waitingForYou: row.status === "WAITING_CITIZEN",
      handledInDays: end ? Math.max(0, Math.round((end.getTime() - row.createdAt.getTime()) / 86_400_000)) : null,
    };
  });

  const open = all.filter((row) => (OPEN as readonly string[]).includes(row.status));
  const done = all.filter((row) => (DONE as readonly string[]).includes(row.status));
  const durations = done.map((row) => row.handledInDays).filter((days): days is number => days !== null);
  return {
    generatedAt: new Date().toISOString(),
    resident: { name: actor.name },
    filter,
    totals: {
      all: all.length,
      open: open.length,
      waitingForYou: all.filter((row) => row.waitingForYou).length,
      done: done.length,
      averageDays: durations.length > 0 ? Math.round((durations.reduce((sum, days) => sum + days, 0) / durations.length) * 10) / 10 : null,
    },
    rows: filter === "open" ? open : filter === "done" ? done : all,
  };
}
