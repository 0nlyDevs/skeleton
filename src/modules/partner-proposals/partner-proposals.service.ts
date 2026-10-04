/**
 * F99 — outside partners offer their services through the city's platform.
 * Anyone can send a proposal (protected against robots and rate limited);
 * city staff accept it, which adds it to the catalogue as a partner service
 * residents can find, or decline it with a reason.
 */

import { randomInt } from "node:crypto";

import { isStaff } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { assertHumanForm } from "@/lib/security/form-guard";
import { slugify } from "@/lib/utils";
import type { AuthUser } from "@/types";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";
import type { PartnerProposalDecision, PartnerProposalInput } from "./partner-proposals.schema";

export interface PartnerProposalDto {
  readonly id: string;
  readonly reference: string;
  readonly organisation: string;
  readonly contactName: string;
  readonly email: string;
  readonly phone: string | null;
  readonly serviceName: string;
  readonly summary: string;
  readonly description: string;
  readonly address: string | null;
  readonly hours: string | null;
  readonly status: "PENDING" | "ACCEPTED" | "DECLINED";
  readonly answer: string | null;
  readonly decidedAt: string | null;
  readonly serviceSlug: string | null;
  readonly createdAt: string;
}

type Row = Awaited<ReturnType<typeof prisma.partnerProposal.findFirstOrThrow>>;

function toDto(row: Row): PartnerProposalDto {
  return {
    id: row.id,
    reference: row.reference,
    organisation: row.organisation,
    contactName: row.contactName,
    email: row.email,
    phone: row.phone,
    serviceName: row.serviceName,
    summary: row.summary,
    description: row.description,
    address: row.address,
    hours: row.hours,
    status: row.status,
    answer: row.answer,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    serviceSlug: row.serviceSlug,
    createdAt: row.createdAt.toISOString(),
  };
}

function assertStaff(actor: AuthUser): void {
  if (!isStaff(actor)) throw new ForbiddenError("Only city staff can review partner proposals.");
}

/** Public: the partner only gets a reference back, never the stored row. */
export async function submitPartnerProposal(input: PartnerProposalInput): Promise<{ reference: string }> {
  const { guard, ...fields } = input;
  assertHumanForm("partner-proposal", guard);
  const waiting = await prisma.partnerProposal.count({ where: { email: fields.email, status: "PENDING" } });
  if (waiting >= 3) throw new ConflictError("You already have proposals waiting for an answer.");
  const reference = `PAR-${randomInt(100_000, 1_000_000)}`;
  await prisma.partnerProposal.create({ data: { ...fields, phone: fields.phone ?? null, address: fields.address ?? null, hours: fields.hours ?? null, reference } });
  return { reference };
}

export async function listPartnerProposals(actor: AuthUser): Promise<PartnerProposalDto[]> {
  assertStaff(actor);
  const rows = await prisma.partnerProposal.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100 });
  return rows.map(toDto);
}

async function freeSlug(name: string): Promise<string> {
  const base = slugify(name).slice(0, 60) || "partenaire";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${randomInt(100, 9999)}`;
    if (!(await prisma.municipalService.findUnique({ where: { slug: candidate }, select: { id: true } }))) return candidate;
  }
  return `partenaire-${randomInt(10 ** 6, 10 ** 7)}`;
}

export async function decidePartnerProposal(id: string, input: PartnerProposalDecision, actor: AuthUser, ip: string | null): Promise<PartnerProposalDto> {
  assertStaff(actor);
  const proposal = await prisma.partnerProposal.findUnique({ where: { id } });
  if (!proposal) throw new NotFoundError("That proposal does not exist.");
  if (input.decision === "decline" && !input.answer) throw new BadRequestError("Give the partner a reason for declining.");

  // Only one agent can answer: the claim is a single conditional write.
  const accepted = input.decision === "accept";
  const claim = await prisma.partnerProposal.updateMany({
    where: { id, status: "PENDING" },
    data: { status: accepted ? "ACCEPTED" : "DECLINED", answer: input.answer ?? null, decidedById: actor.id, decidedAt: new Date() },
  });
  if (claim.count === 0) throw new ConflictError("This proposal has already been answered.");

  let serviceSlug: string | null = null;
  if (accepted) {
    serviceSlug = await freeSlug(proposal.serviceName);
    await prisma.municipalService.create({
      data: {
        slug: serviceSlug,
        name: proposal.serviceName,
        category: "Associations partenaires",
        icon: "users",
        summary: proposal.summary,
        description: `${proposal.description}\n\nProposé par ${proposal.organisation}.`,
        email: proposal.email,
        phone: proposal.phone,
        hours: proposal.hours,
        address: proposal.address,
        partner: true,
        sortOrder: 250,
        translations: {},
      },
    });
    await prisma.partnerProposal.update({ where: { id }, data: { serviceSlug } });
  }
  await recordAudit({
    actorId: actor.id,
    action: auditActions.partnerProposalChanged,
    targetType: "partner_proposal",
    targetId: id,
    metadata: { op: accepted ? "accept" : "decline", reference: proposal.reference, name: proposal.serviceName, organisation: proposal.organisation, slug: serviceSlug },
    ip,
  });
  return toDto(await prisma.partnerProposal.findUniqueOrThrow({ where: { id } }));
}
