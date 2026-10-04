import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined);

/** F99 — what a partner fills in to offer a service to residents. */
export const partnerProposalInputSchema = z
  .object({
    organisation: z.string().trim().min(2, "Give the name of your organisation.").max(120),
    contactName: z.string().trim().min(2, "Give the name of the person to contact.").max(120),
    email: z.string().trim().toLowerCase().email("Give a valid email address.").max(160),
    phone: optionalText(40),
    serviceName: z.string().trim().min(3, "Give the service a name.").max(120),
    summary: z.string().trim().min(10, "Say in one sentence what the service offers.").max(240),
    description: z.string().trim().min(20, "Describe the service in a few sentences.").max(2000),
    address: optionalText(200),
    hours: optionalText(160),
    /** F81 — the form's token and its hidden trap field. */
    guard: z.object({ token: z.string().max(200).nullable().optional(), trap: z.string().max(200).optional() }).strict().optional(),
  })
  .strict();
export type PartnerProposalInput = z.infer<typeof partnerProposalInputSchema>;

export const partnerProposalIdSchema = z.object({ id: z.string().trim().min(1).max(64) });

export const partnerProposalDecisionSchema = z
  .object({
    decision: z.enum(["accept", "decline"]),
    answer: z.string().trim().max(300).optional(),
  })
  .strict();
export type PartnerProposalDecision = z.infer<typeof partnerProposalDecisionSchema>;
