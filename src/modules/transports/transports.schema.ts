import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour time, for example 06:30.");

export const transportLineInputSchema = z.object({
  code: z.string().trim().min(1).max(20).transform((value) => value.toUpperCase()).refine((value) => /^[A-Z0-9-]+$/.test(value), "Use letters, digits or dashes for the line code."),
  name: z.string().trim().min(2).max(140),
  description: z.string().trim().max(500).nullable().optional(),
  stops: z.array(z.string().trim().min(2).max(120)).min(2).max(60),
  firstDeparture: time,
  lastDeparture: time,
  headwayMinutes: z.number().int().min(1).max(180),
  serviceDays: z.string().trim().min(2).max(120),
  alert: z.string().trim().max(500).nullable().optional(),
  published: z.boolean(),
}).strict().refine((value) => value.lastDeparture > value.firstDeparture, { path: ["lastDeparture"], message: "Last departure must be later than first departure." });

export const transportLineIdSchema = z.object({ id: z.string().min(1).max(191) });
export type TransportLineInput = z.infer<typeof transportLineInputSchema>;
