/**
 * F65–F68 — residents take part in the city's decisions:
 *   - projects they can read and give an opinion on (F67, F66);
 *   - decisions put to the vote, one ballot each, with a receipt (F65);
 *   - ideas of their own, supported by others and answered by the city (F68).
 * Residents read and take part; administrators publish projects and
 * decisions; agents answer ideas. Results only show totals, never who chose.
 */

import { randomBytes, randomInt } from "node:crypto";

import { isAdmin, isStaff } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { RATE_LIMITS, enforceThenRecord, rateLimitKey } from "@/lib/rate-limit";
import { slugify } from "@/lib/utils";
import type { AuthUser } from "@/types";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";
import { createNotification, notifyInBackground } from "../notifications/notifications.service";
import type { DecisionInput, IdeaAnswerInput, IdeaInput, OpinionInput, ProjectInput } from "./participation.schema";

const day = (value: string | null | undefined): Date | null => (value ? new Date(`${value}T00:00:00Z`) : null);

async function uniqueSlug(table: "cityProject" | "decision", text: string): Promise<string> {
  const base = slugify(text).slice(0, 70) || "sujet";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${randomInt(100, 9999)}`;
    const taken = table === "cityProject" ? await prisma.cityProject.findUnique({ where: { slug: candidate }, select: { id: true } }) : await prisma.decision.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${base}-${randomInt(10 ** 6, 10 ** 7)}`;
}

async function everyone(): Promise<string[]> {
  return (await prisma.user.findMany({ where: { banned: false }, select: { id: true }, take: 2_000 })).map((row) => row.id);
}

// --- F67 / F66: projects and opinions --------------------------------------

export interface ProjectDto {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly body: string;
  readonly zone: string | null;
  readonly budget: number | null;
  readonly status: "PLANNED" | "IN_PROGRESS" | "DONE";
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly progress: number;
  readonly consultationOpen: boolean;
  /** F66 — totals only. */
  readonly opinions: { readonly for: number; readonly against: number; readonly neutral: number };
  /** The viewer's own opinion, once given. */
  readonly mine: { readonly stance: "FOR" | "AGAINST" | "NEUTRAL"; readonly comment: string | null } | null;
}

type ProjectRow = Awaited<ReturnType<typeof prisma.cityProject.findFirstOrThrow>>;

async function toProjectDto(row: ProjectRow, viewer: AuthUser | null): Promise<ProjectDto> {
  const [grouped, mine] = await Promise.all([
    prisma.projectOpinion.groupBy({ by: ["stance"], where: { projectId: row.id }, _count: { _all: true } }),
    viewer ? prisma.projectOpinion.findUnique({ where: { projectId_userId: { projectId: row.id, userId: viewer.id } }, select: { stance: true, comment: true } }) : null,
  ]);
  const count = (stance: string) => grouped.find((entry) => entry.stance === stance)?._count._all ?? 0;
  return {
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    body: row.body,
    zone: row.zone,
    budget: row.budget,
    status: row.status,
    startsOn: row.startsOn?.toISOString().slice(0, 10) ?? null,
    endsOn: row.endsOn?.toISOString().slice(0, 10) ?? null,
    progress: row.progress,
    consultationOpen: row.consultationOpen,
    opinions: { for: count("FOR"), against: count("AGAINST"), neutral: count("NEUTRAL") },
    mine,
  };
}

export async function listProjects(viewer: AuthUser | null): Promise<ProjectDto[]> {
  const rows = await prisma.cityProject.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100 });
  return Promise.all(rows.map((row) => toProjectDto(row, viewer)));
}

export async function getProject(slug: string, viewer: AuthUser | null): Promise<ProjectDto> {
  const row = await prisma.cityProject.findUnique({ where: { slug } });
  if (!row) throw new NotFoundError("This project does not exist.");
  return toProjectDto(row, viewer);
}

export async function saveProject(input: ProjectInput, actor: AuthUser, ip: string | null, slug?: string): Promise<ProjectDto> {
  if (!isAdmin(actor)) throw new ForbiddenError("Only administrators can publish city projects.");
  const data = {
    title: input.title,
    summary: input.summary,
    body: input.body,
    zone: input.zone ?? null,
    budget: input.budget ?? null,
    status: input.status,
    startsOn: day(input.startsOn),
    endsOn: day(input.endsOn),
    progress: input.status === "DONE" ? 100 : input.progress,
    consultationOpen: input.status === "DONE" ? false : input.consultationOpen,
  };
  const existing = slug ? await prisma.cityProject.findUnique({ where: { slug } }) : null;
  if (slug && !existing) throw new NotFoundError("This project does not exist.");
  const row = existing ? await prisma.cityProject.update({ where: { id: existing.id }, data }) : await prisma.cityProject.create({ data: { ...data, slug: await uniqueSlug("cityProject", input.title) } });
  await recordAudit({ actorId: actor.id, action: auditActions.participationChanged, targetType: "city_project", targetId: row.id, metadata: { op: existing ? "update" : "create", title: row.title, slug: row.slug }, ip });
  if (!existing) {
    notifyInBackground(
      (async () => {
        for (const id of await everyone()) await createNotification({ userId: id, type: "ANNOUNCEMENT", title: `Nouveau projet de la ville : ${row.title.slice(0, 110)}`, body: row.summary, link: `/participate/projects/${row.slug}` });
      })(),
      { projectId: row.id },
    );
  }
  return toProjectDto(row, actor);
}

export async function giveOpinion(slug: string, input: OpinionInput, actor: AuthUser, ip: string | null): Promise<ProjectDto> {
  await enforceThenRecord([{ key: rateLimitKey("participation:opinion", actor.id), rule: RATE_LIMITS.serviceFeedback }]);
  const project = await prisma.cityProject.findUnique({ where: { slug } });
  if (!project) throw new NotFoundError("This project does not exist.");
  if (!project.consultationOpen) throw new ConflictError("The consultation on this project is closed.");
  await prisma.projectOpinion.upsert({
    where: { projectId_userId: { projectId: project.id, userId: actor.id } },
    create: { projectId: project.id, userId: actor.id, stance: input.stance, comment: input.comment || null },
    update: { stance: input.stance, comment: input.comment || null },
  });
  await recordAudit({ actorId: actor.id, action: auditActions.participationChanged, targetType: "city_project", targetId: project.id, metadata: { op: "opinion", title: project.title, stance: input.stance }, ip });
  return toProjectDto(project, actor);
}

// --- F65: decisions and ballots --------------------------------------------

export interface DecisionDto {
  readonly slug: string;
  readonly question: string;
  readonly description: string;
  readonly opensAt: string;
  readonly closesAt: string;
  readonly state: "UPCOMING" | "OPEN" | "CLOSED";
  readonly options: { readonly id: string; readonly label: string; readonly votes: number | null }[];
  /** Total ballots; shown while the vote is open too. */
  readonly total: number;
  /** The viewer's receipt, once voted: proof the ballot counted, not what was chosen. */
  readonly receipt: string | null;
  /** What the viewer chose; shown only to them. */
  readonly myOptionId: string | null;
}

type DecisionRow = Awaited<ReturnType<typeof loadDecision>>;

function loadDecision(where: { slug: string } | { id: string }) {
  return prisma.decision.findUnique({ where, include: { options: { orderBy: { position: "asc" }, include: { _count: { select: { ballots: true } } } } } });
}

async function toDecisionDto(row: NonNullable<DecisionRow>, viewer: AuthUser | null): Promise<DecisionDto> {
  const now = new Date();
  const state = now < row.opensAt ? "UPCOMING" : now > row.closesAt ? "CLOSED" : "OPEN";
  const ballot = viewer ? await prisma.decisionBallot.findUnique({ where: { decisionId_userId: { decisionId: row.id, userId: viewer.id } }, select: { receipt: true, optionId: true } }) : null;
  return {
    slug: row.slug,
    question: row.question,
    description: row.description,
    opensAt: row.opensAt.toISOString(),
    closesAt: row.closesAt.toISOString(),
    state,
    // Results are published when the vote closes: nobody votes after seeing a trend.
    options: row.options.map((option) => ({ id: option.id, label: option.label, votes: state === "CLOSED" ? option._count.ballots : null })),
    total: row.options.reduce((sum, option) => sum + option._count.ballots, 0),
    receipt: ballot?.receipt ?? null,
    myOptionId: ballot?.optionId ?? null,
  };
}

export async function listDecisions(viewer: AuthUser | null): Promise<DecisionDto[]> {
  const rows = await prisma.decision.findMany({ orderBy: { closesAt: "desc" }, take: 50, include: { options: { orderBy: { position: "asc" }, include: { _count: { select: { ballots: true } } } } } });
  return Promise.all(rows.map((row) => toDecisionDto(row, viewer)));
}

export async function getDecision(slug: string, viewer: AuthUser | null): Promise<DecisionDto> {
  const row = await loadDecision({ slug });
  if (!row) throw new NotFoundError("This vote does not exist.");
  return toDecisionDto(row, viewer);
}

export async function createDecision(input: DecisionInput, actor: AuthUser, ip: string | null): Promise<DecisionDto> {
  if (!isAdmin(actor)) throw new ForbiddenError("Only administrators can open a vote.");
  const created = await prisma.decision.create({
    data: {
      slug: await uniqueSlug("decision", input.question),
      question: input.question,
      description: input.description,
      opensAt: new Date(input.opensAt),
      closesAt: new Date(input.closesAt),
      options: { create: input.options.map((label, position) => ({ label, position })) },
    },
  });
  await recordAudit({ actorId: actor.id, action: auditActions.participationChanged, targetType: "decision", targetId: created.id, metadata: { op: "create_vote", title: created.question, slug: created.slug }, ip });
  notifyInBackground(
    (async () => {
      for (const id of await everyone()) await createNotification({ userId: id, type: "ANNOUNCEMENT", title: `Vote ouvert : ${created.question.slice(0, 110)}`, body: "Votre voix compte : un vote par habitant.", link: `/participate/votes/${created.slug}` });
    })(),
    { decisionId: created.id },
  );
  const row = await loadDecision({ id: created.id });
  if (!row) throw new NotFoundError("This vote does not exist.");
  return toDecisionDto(row, actor);
}

export async function castVote(slug: string, optionId: string, actor: AuthUser, ip: string | null): Promise<DecisionDto> {
  const row = await loadDecision({ slug });
  if (!row) throw new NotFoundError("This vote does not exist.");
  const now = new Date();
  if (now < row.opensAt) throw new ConflictError("This vote is not open yet.");
  if (now > row.closesAt) throw new ConflictError("This vote is closed.");
  if (!row.options.some((option) => option.id === optionId)) throw new BadRequestError("Choose one of the options.");
  const receipt = `VT-${randomBytes(4).toString("hex").toUpperCase()}`;
  try {
    // The unique (decision, resident) rule makes "one ballot each" a database fact, not a check that can race.
    await prisma.decisionBallot.create({ data: { decisionId: row.id, optionId, userId: actor.id, receipt } });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") throw new ConflictError("You already voted on this question.");
    throw error;
  }
  // The trail keeps that a ballot was cast, never what it said.
  await recordAudit({ actorId: actor.id, action: auditActions.participationChanged, targetType: "decision", targetId: row.id, metadata: { op: "vote", title: row.question }, ip });
  const fresh = await loadDecision({ id: row.id });
  if (!fresh) throw new NotFoundError("This vote does not exist.");
  return toDecisionDto(fresh, actor);
}

// --- F68: ideas -------------------------------------------------------------

export interface IdeaDto {
  readonly reference: string;
  readonly title: string;
  readonly body: string;
  readonly zone: string | null;
  readonly status: (typeof import("./participation.schema").IDEA_STATUSES)[number];
  readonly answer: string | null;
  readonly supports: number;
  readonly supportedByMe: boolean;
  readonly mine: boolean;
  readonly createdAt: string;
}

type IdeaRow = Awaited<ReturnType<typeof prisma.idea.findFirstOrThrow<{ include: { _count: { select: { supports: true } } } }>>>;

async function toIdeaDtos(rows: IdeaRow[], viewer: AuthUser | null): Promise<IdeaDto[]> {
  const mine = viewer ? new Set((await prisma.ideaSupport.findMany({ where: { userId: viewer.id, ideaId: { in: rows.map((row) => row.id) } }, select: { ideaId: true } })).map((row) => row.ideaId)) : new Set<string>();
  return rows.map((row) => ({
    reference: row.reference,
    title: row.title,
    body: row.body,
    zone: row.zone,
    status: row.status,
    answer: row.answer,
    supports: row._count.supports,
    supportedByMe: mine.has(row.id),
    mine: viewer?.id === row.authorId,
    createdAt: row.createdAt.toISOString(),
  }));
}

/** Ideas carry no author name: only the author sees which ones are theirs. */
export async function listIdeas(query: { status?: string | undefined; zone?: string | undefined; sort: "supported" | "recent" }, viewer: AuthUser | null): Promise<IdeaDto[]> {
  const rows = await prisma.idea.findMany({
    where: { ...(query.status ? { status: query.status as IdeaRow["status"] } : {}), ...(query.zone ? { zone: query.zone as NonNullable<IdeaRow["zone"]> } : {}) },
    include: { _count: { select: { supports: true } } },
    orderBy: query.sort === "supported" ? [{ supports: { _count: "desc" } }, { createdAt: "desc" }] : [{ createdAt: "desc" }],
    take: 100,
  });
  return toIdeaDtos(rows, viewer);
}

export async function createIdea(input: IdeaInput, actor: AuthUser, ip: string | null): Promise<IdeaDto> {
  await enforceThenRecord([{ key: rateLimitKey("participation:idea", actor.id), rule: RATE_LIMITS.cityRequestCreate }]);
  let reference = "";
  for (let attempt = 0; attempt < 10 && !reference; attempt += 1) {
    const candidate = `ID-${String(randomInt(0, 1_000_000)).padStart(6, "0")}`;
    if (!(await prisma.idea.findUnique({ where: { reference: candidate }, select: { id: true } }))) reference = candidate;
  }
  if (!reference) throw new ConflictError("Could not allocate an idea reference.");
  const row = await prisma.idea.create({ data: { reference, title: input.title, body: input.body, zone: input.zone ?? null, authorId: actor.id }, include: { _count: { select: { supports: true } } } });
  await recordAudit({ actorId: actor.id, action: auditActions.participationChanged, targetType: "idea", targetId: row.id, metadata: { op: "idea", title: row.title, reference }, ip });
  return (await toIdeaDtos([row], actor))[0] as IdeaDto;
}

export async function setIdeaSupport(reference: string, support: boolean, actor: AuthUser): Promise<IdeaDto> {
  await enforceThenRecord([{ key: rateLimitKey("participation:support", actor.id), rule: RATE_LIMITS.follow }]);
  const idea = await prisma.idea.findUnique({ where: { reference }, select: { id: true, authorId: true } });
  if (!idea) throw new NotFoundError("This idea does not exist.");
  if (support) {
    if (idea.authorId === actor.id) throw new BadRequestError("You cannot support your own idea.");
    await prisma.ideaSupport.upsert({ where: { ideaId_userId: { ideaId: idea.id, userId: actor.id } }, create: { ideaId: idea.id, userId: actor.id }, update: {} });
  } else {
    await prisma.ideaSupport.deleteMany({ where: { ideaId: idea.id, userId: actor.id } });
  }
  const row = await prisma.idea.findUniqueOrThrow({ where: { id: idea.id }, include: { _count: { select: { supports: true } } } });
  return (await toIdeaDtos([row], actor))[0] as IdeaDto;
}

export async function answerIdea(reference: string, input: IdeaAnswerInput, actor: AuthUser, ip: string | null): Promise<IdeaDto> {
  if (!isStaff(actor)) throw new NotFoundError("This idea does not exist.");
  const existing = await prisma.idea.findUnique({ where: { reference } });
  if (!existing) throw new NotFoundError("This idea does not exist.");
  const row = await prisma.idea.update({ where: { id: existing.id }, data: { status: input.status, answer: input.answer || null }, include: { _count: { select: { supports: true } } } });
  await recordAudit({ actorId: actor.id, action: auditActions.participationChanged, targetType: "idea", targetId: row.id, metadata: { op: "answer", title: row.title, reference, status: row.status }, ip });
  if (existing.status !== row.status) {
    notifyInBackground(
      createNotification({ userId: row.authorId, type: "ANNOUNCEMENT", title: `Votre idée ${row.reference} : ${row.status === "KEPT" ? "retenue" : row.status === "DECLINED" ? "non retenue" : row.status === "DONE" ? "réalisée" : "à l'étude"}`, body: row.answer ?? "La ville étudie votre idée.", link: `/participate?tab=ideas#${row.reference}`, email: true }),
      { ideaId: row.id },
    );
  }
  return (await toIdeaDtos([row], actor))[0] as IdeaDto;
}
