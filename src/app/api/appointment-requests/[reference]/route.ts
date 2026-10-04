import { apiRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { appointmentRequestRefParamSchema } from "@/modules/appointments/appointments.schema";
import { cancelAppointmentRequest } from "@/modules/appointments/appointment-requests.service";

/** The resident withdraws a request that is still waiting. */
export const DELETE = apiRoute({
  params: appointmentRequestRefParamSchema,
  handler: async ({ params, auth, ip }) => jsonOk({ data: await cancelAppointmentRequest(params.reference, auth.user, ip) }),
});
