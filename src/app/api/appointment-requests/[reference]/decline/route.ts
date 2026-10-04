import { apiRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { appointmentRequestDeclineSchema, appointmentRequestRefParamSchema } from "@/modules/appointments/appointments.schema";
import { declineAppointmentRequest } from "@/modules/appointments/appointment-requests.service";

export const POST = apiRoute({
  roles: ["AGENT", "ADMIN"],
  params: appointmentRequestRefParamSchema,
  body: appointmentRequestDeclineSchema,
  handler: async ({ params, body, auth, ip }) => jsonOk({ data: await declineAppointmentRequest(params.reference, body.reason, auth.user, ip) }),
});
