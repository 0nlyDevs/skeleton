/**
 * F83 — proof that the city received a request: a receipt the resident can
 * print or quote, with a short code anyone can check against the reference.
 * The code is a signature of the reference and the reception time, so it
 * cannot be invented; checking it reveals nothing personal.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";

export function receiptCode(reference: string, receivedAt: Date): string {
  const digest = createHmac("sha256", env.BETTER_AUTH_SECRET).update(`receipt:${reference}:${receivedAt.toISOString()}`).digest("hex").toUpperCase();
  return `${digest.slice(0, 4)}-${digest.slice(4, 8)}`;
}

export interface ReceiptCheckDto {
  readonly valid: boolean;
  /** Set when valid: when the city received the request, and for which service. */
  readonly receivedAt: string | null;
  readonly service: string | null;
}

export async function checkReceipt(reference: string, code: string): Promise<ReceiptCheckDto> {
  const row = await prisma.cityRequest.findUnique({ where: { reference }, select: { createdAt: true, service: { select: { name: true } } } });
  const invalid = { valid: false, receivedAt: null, service: null } as const;
  if (!row) return invalid;
  const expected = Buffer.from(receiptCode(reference, row.createdAt));
  const given = Buffer.from(code.trim().toUpperCase());
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return invalid;
  return { valid: true, receivedAt: row.createdAt.toISOString(), service: row.service?.name ?? null };
}
