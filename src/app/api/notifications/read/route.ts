import { markNotificationsReadRoute } from "@/modules/notifications/notifications.routes";

/** Body: `{ ids: [...] }` for specific rows, or `{}` to mark everything read. */
export const POST = markNotificationsReadRoute;
