import { z } from "zod";

/**
 * F73 — pages an official message may send residents to. A fixed list, so a
 * message can never point outside the app or to a page that does not exist.
 */
export const OFFICIAL_LINKS = ["/alerts", "/services", "/contact", "/announcements", "/transports", "/city-map", "/appointments"] as const;
export type OfficialLink = (typeof OFFICIAL_LINKS)[number];

/** How long the message stays on every screen; `null` keeps it until withdrawn. */
export const OFFICIAL_DURATIONS = [1, 6, 24, 72, 168] as const;

export const officialMessageInputSchema = z
  .object({
    title: z.string().trim().min(5, "Give the message a title.").max(140),
    body: z.string().trim().min(10, "Say what residents must know.").max(600),
    action: z.string().trim().max(300).optional().nullable().transform((value) => value || null),
    linkHref: z.enum(OFFICIAL_LINKS).optional().nullable().transform((value) => value ?? null),
    durationHours: z.union([z.literal(1), z.literal(6), z.literal(24), z.literal(72), z.literal(168)]).nullable().default(24),
  })
  .strict();
export type OfficialMessageInput = z.infer<typeof officialMessageInputSchema>;

export const officialMessageIdParamSchema = z.object({ id: z.string().trim().min(1).max(40) });

export const listOfficialMessagesQuerySchema = z.object({
  /** `current` is public (the message on screen now); `history` is for administrators. */
  view: z.enum(["current", "history"]).default("current"),
});
export type ListOfficialMessagesQuery = z.infer<typeof listOfficialMessagesQuerySchema>;
