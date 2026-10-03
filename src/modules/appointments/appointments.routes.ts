import { NextResponse } from "next/server";

import { apiRoute, publicRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { getLocale } from "@/lib/i18n/server";
import { RATE_LIMITS } from "@/lib/rate-limit";

import {
  appointmentOutcomeInputSchema,
  appointmentReferenceParamSchema,
  bookAppointmentInputSchema,
  cancelAppointmentInputSchema,
  freeSlotsQuerySchema,
  openSlotsInputSchema,
  reminderPreferencesInputSchema,
  slotIdParamSchema,
} from "./appointments.schema";
import {
  appointmentCalendar,
  bookAppointment,
  cancelAppointment,
  getAppointment,
  getPreparationAdvice,
  listMyAppointments,
  setAppointmentOutcome,
  setReminderPreferences,
} from "./appointments.service";
import { deleteSlot, listFreeSlots, listMySlots, openSlots } from "./appointments.slots";

/** Free slots are public: a resident can look before signing in. */
export const listFreeSlotsRoute = publicRoute({
  query: freeSlotsQuerySchema,
  rateLimit: RATE_LIMITS.public,
  handler: async ({ query }) => jsonOk({ data: await listFreeSlots({ service: query.service }) }),
});

export const bookAppointmentRoute = apiRoute({
  body: bookAppointmentInputSchema,
  rateLimit: RATE_LIMITS.appointmentBook,
  handler: async ({ body, auth, ip }) => jsonOk({ data: await bookAppointment(body, auth.user, ip) }, 201),
});

export const listMyAppointmentsRoute = apiRoute({
  handler: async ({ auth }) => jsonOk({ data: await listMyAppointments(auth.user) }),
});

export const getAppointmentRoute = apiRoute({
  params: appointmentReferenceParamSchema,
  handler: async ({ params, auth }) => jsonOk({ data: await getAppointment(params.reference, auth.user) }),
});

export const cancelAppointmentRoute = apiRoute({
  params: appointmentReferenceParamSchema,
  body: cancelAppointmentInputSchema,
  handler: async ({ params, body, auth, ip }) => jsonOk({ data: await cancelAppointment(params.reference, body.reason, auth.user, ip) }),
});

export const setRemindersRoute = apiRoute({
  params: appointmentReferenceParamSchema,
  body: reminderPreferencesInputSchema,
  handler: async ({ params, body, auth }) => jsonOk({ data: await setReminderPreferences(params.reference, body, auth.user) }),
});

export const setOutcomeRoute = apiRoute({
  roles: ["AGENT", "ADMIN"],
  params: appointmentReferenceParamSchema,
  body: appointmentOutcomeInputSchema,
  handler: async ({ params, body, auth, ip }) => jsonOk({ data: await setAppointmentOutcome(params.reference, body.status, auth.user, ip) }),
});

/** Optional AI help; the fixed checklist answers when the assistant cannot. */
export const preparationRoute = apiRoute({
  params: appointmentReferenceParamSchema,
  rateLimit: RATE_LIMITS.ai,
  handler: async ({ params, auth }) => jsonOk({ data: await getPreparationAdvice(params.reference, auth.user, (await getLocale()) === "en" ? "en" : "fr") }),
});

export const calendarRoute = apiRoute({
  params: appointmentReferenceParamSchema,
  handler: async ({ params, auth }) =>
    new NextResponse(await appointmentCalendar(params.reference, auth.user), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${params.reference}.ics"`,
        "Cache-Control": "private, no-store",
      },
    }),
});

export const openSlotsRoute = apiRoute({
  roles: ["AGENT", "ADMIN"],
  body: openSlotsInputSchema,
  rateLimit: RATE_LIMITS.slotOpen,
  handler: async ({ body, auth }) => jsonOk({ data: await openSlots(body, auth.user) }, 201),
});

export const listMySlotsRoute = apiRoute({
  roles: ["AGENT", "ADMIN"],
  handler: async ({ auth }) => jsonOk({ data: await listMySlots(auth.user) }),
});

export const deleteSlotRoute = apiRoute({
  roles: ["AGENT", "ADMIN"],
  params: slotIdParamSchema,
  handler: async ({ params, auth }) => {
    await deleteSlot(params.id, auth.user);
    return jsonOk({ data: { ok: true } });
  },
});
