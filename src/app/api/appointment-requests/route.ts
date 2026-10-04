import { apiRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { isStaff } from "@/lib/auth/guards";
import { appointmentRequestInputSchema } from "@/modules/appointments/appointments.schema";
import { createAppointmentRequest, listMyAppointmentRequests, listPendingAppointmentRequests } from "@/modules/appointments/appointment-requests.service";

/** Residents list their own requests; staff list the ones waiting for an answer. */
export const GET = apiRoute({
  handler: async ({ auth, request }) => {
    const staffView = new URL(request.url).searchParams.get("scope") === "pending";
    return jsonOk({ data: staffView && isStaff(auth.user) ? await listPendingAppointmentRequests(auth.user) : await listMyAppointmentRequests(auth.user) });
  },
});

/** A resident asks for an appointment at a time of their choice. */
export const POST = apiRoute({
  body: appointmentRequestInputSchema,
  handler: async ({ body, auth, ip }) => jsonOk({ data: await createAppointmentRequest(body, auth.user, ip) }, 201),
});
