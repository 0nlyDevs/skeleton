import { bookAppointmentRoute, listMyAppointmentsRoute } from "@/modules/appointments/appointments.routes";

/** F39 — the signed-in resident's appointments; booking a slot. */
export const GET = listMyAppointmentsRoute;
export const POST = bookAppointmentRoute;
