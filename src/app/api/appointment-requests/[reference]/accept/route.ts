import { apiRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { appointmentRequestAcceptSchema, appointmentRequestRefParamSchema } from "@/modules/appointments/appointments.schema";
import { acceptAppointmentRequest } from "@/modules/appointments/appointment-requests.service";

export const POST = apiRoute({
  roles: ["AGENT", "ADMIN"],
  params: appointmentRequestRefParamSchema,
  body: appointmentRequestAcceptSchema,
  handler: async ({ params, body, auth, ip }) => jsonOk({ data: await acceptAppointmentRequest(params.reference, body, auth.user, ip) }),
});
