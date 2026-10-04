import { z } from "zod";

import { SLOT_DURATIONS } from "./appointments.time";

export const APPOINTMENT_MODES = ["IN_PERSON", "PHONE"] as const;

/** An agent opens a block of slots on one day (city time). */
export const openSlotsInputSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a day."),
    from: z.string().regex(/^\d{2}:\d{2}$/, "Choose a start time."),
    to: z.string().regex(/^\d{2}:\d{2}$/, "Choose an end time."),
    duration: z.coerce.number().refine((value) => (SLOT_DURATIONS as readonly number[]).includes(value), "Choose a slot length."),
    mode: z.enum(APPOINTMENT_MODES).default("IN_PERSON"),
    location: z.string().trim().max(200).optional().nullable().transform((value) => value || null),
    serviceSlug: z.string().trim().toLowerCase().max(80).optional().nullable().transform((value) => value || null),
  })
  .strict()
  .refine((value) => value.to > value.from, { message: "The end must come after the start.", path: ["to"] })
  .refine((value) => value.mode === "PHONE" || value.location, { message: "Say where the resident should go.", path: ["location"] });

export type OpenSlotsInput = z.infer<typeof openSlotsInputSchema>;

/** A resident books one slot. */
export const bookAppointmentInputSchema = z
  .object({
    slotId: z.string().trim().min(1).max(40),
    reason: z.string().trim().min(10, "Say in a sentence what the appointment is about.").max(1000),
    remindDayBefore: z.boolean().default(true),
    remindHourBefore: z.boolean().default(true),
  })
  .strict();

export type BookAppointmentInput = z.infer<typeof bookAppointmentInputSchema>;

export const cancelAppointmentInputSchema = z
  .object({ reason: z.string().trim().max(300).optional().nullable().transform((value) => value || null) })
  .strict();

/** The agent records how it went. */
export const appointmentOutcomeInputSchema = z.object({ status: z.enum(["DONE", "MISSED"]) }).strict();

export const reminderPreferencesInputSchema = z
  .object({ remindDayBefore: z.boolean(), remindHourBefore: z.boolean() })
  .strict();

export const freeSlotsQuerySchema = z.object({
  service: z.string().trim().toLowerCase().max(80).optional(),
});

export const appointmentReferenceParamSchema = z.object({ reference: z.string().trim().toUpperCase().regex(/^RDV-\d{6}$/) });
export const slotIdParamSchema = z.object({ id: z.string().trim().min(1).max(40) });

/** A resident asks for an appointment at a time of their choice. */
export const appointmentRequestInputSchema = z
  .object({
    startsAt: z.string().datetime({ offset: true }),
    duration: z.coerce.number().refine((value) => (SLOT_DURATIONS as readonly number[]).includes(value), "Choose a slot length."),
    mode: z.enum(APPOINTMENT_MODES).default("IN_PERSON"),
    serviceSlug: z.string().trim().toLowerCase().max(80).optional().nullable().transform((value) => value || null),
    reason: z.string().trim().min(10, "Say in a sentence what the appointment is about.").max(1000),
  })
  .strict();
export type AppointmentRequestInput = z.infer<typeof appointmentRequestInputSchema>;

/** An agent accepts, at the asked time or at another one. */
export const appointmentRequestAcceptSchema = z
  .object({
    startsAt: z.string().datetime({ offset: true }).optional().nullable().transform((value) => value || null),
    location: z.string().trim().max(200).optional().nullable().transform((value) => value || null),
    note: z.string().trim().max(300).optional().nullable().transform((value) => value || null),
  })
  .strict();
export type AppointmentRequestAcceptInput = z.infer<typeof appointmentRequestAcceptSchema>;

export const appointmentRequestDeclineSchema = z.object({ reason: z.string().trim().min(5, "Give the resident a reason.").max(300) }).strict();
export const appointmentRequestRefParamSchema = z.object({ reference: z.string().trim().toUpperCase().regex(/^DEM-\d{6}$/, "Invalid reference.") });
