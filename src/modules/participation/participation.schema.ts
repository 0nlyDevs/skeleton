import { z } from "zod";

import { CITY_ZONE_IDS } from "@/modules/alerts/city-zones";

const zone = z.enum(CITY_ZONE_IDS).nullable().optional();

export const slugParamSchema = z.object({ slug: z.string().trim().toLowerCase().min(1).max(100) });
export const ideaRefParamSchema = z.object({ reference: z.string().trim().toUpperCase().regex(/^ID-\d{6}$/, "Invalid reference.") });

/** F67 — a project of the city, written by an administrator. */
export const projectInputSchema = z
  .object({
    title: z.string().trim().min(5, "Give the project a title.").max(160),
    summary: z.string().trim().min(10, "Write a short summary.").max(300),
    body: z.string().trim().min(20, "Describe the project.").max(10_000),
    zone,
    budget: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
    status: z.enum(["PLANNED", "IN_PROGRESS", "DONE"]).default("PLANNED"),
    startsOn: z.string().date().nullable().optional(),
    endsOn: z.string().date().nullable().optional(),
    progress: z.number().int().min(0).max(100).default(0),
    consultationOpen: z.boolean().default(true),
  })
  .strict();
export type ProjectInput = z.infer<typeof projectInputSchema>;

/** F66 — one opinion per resident and project. */
export const opinionInputSchema = z
  .object({ stance: z.enum(["FOR", "AGAINST", "NEUTRAL"]), comment: z.string().trim().max(600).nullable().optional() })
  .strict();
export type OpinionInput = z.infer<typeof opinionInputSchema>;

/** F65 — a decision submitted to a vote, written by an administrator. */
export const decisionInputSchema = z
  .object({
    question: z.string().trim().min(10, "Write the question.").max(200),
    description: z.string().trim().min(10, "Explain what is decided.").max(5_000),
    options: z.array(z.string().trim().min(1).max(120)).min(2, "Give at least two options.").max(8),
    opensAt: z.string().datetime({ offset: true }),
    closesAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .refine((value) => new Date(value.closesAt) > new Date(value.opensAt), { message: "The vote must close after it opens.", path: ["closesAt"] });
export type DecisionInput = z.infer<typeof decisionInputSchema>;

export const voteInputSchema = z.object({ optionId: z.string().trim().min(1).max(40) }).strict();

/** F68 — an idea from a resident. */
export const ideaInputSchema = z
  .object({
    title: z.string().trim().min(5, "Give the idea a title.").max(140),
    body: z.string().trim().min(15, "Describe the idea in a few sentences.").max(1_500),
    zone,
  })
  .strict();
export type IdeaInput = z.infer<typeof ideaInputSchema>;

export const IDEA_STATUSES = ["RECEIVED", "STUDYING", "KEPT", "DECLINED", "DONE"] as const;
export const ideaAnswerSchema = z
  .object({ status: z.enum(IDEA_STATUSES), answer: z.string().trim().max(1_000).nullable().optional() })
  .strict()
  .refine((value) => value.status === "RECEIVED" || value.status === "STUDYING" || (value.answer?.length ?? 0) >= 5, { message: "Explain the city's answer in a sentence.", path: ["answer"] });
export type IdeaAnswerInput = z.infer<typeof ideaAnswerSchema>;

export const listIdeasQuerySchema = z.object({
  status: z.enum(IDEA_STATUSES).optional(),
  zone: z.enum(CITY_ZONE_IDS).optional(),
  sort: z.enum(["supported", "recent"]).default("supported"),
});
