import { apiRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";

import {
  listNotificationsQuerySchema,
  markNotificationsReadSchema,
  notificationPreferencesSchema,
} from "./notifications.schema";
import {
  getPreferences,
  listNotifications,
  markRead,
  updatePreferences,
} from "./notifications.service";

/**
 * `GET /api/notifications?unreadOnly=true&limit=1` doubles as the unread badge
 * query — `meta.total` is the count. One endpoint instead of two, and the badge
 * can never disagree with the list because they are the same query.
 */
export const listNotificationsRoute = apiRoute({
  query: listNotificationsQuerySchema,
  handler: async ({ query, auth }) => jsonOk(await listNotifications(auth.user.id, query)),
});

export const markNotificationsReadRoute = apiRoute({
  body: markNotificationsReadSchema,
  handler: async ({ body, auth }) => {
    const updated = await markRead(auth.user.id, body.ids);
    return jsonOk({ updated });
  },
});

export const getNotificationPreferencesRoute = apiRoute({
  handler: async ({ auth }) => jsonOk(await getPreferences(auth.user.id)),
});

export const updateNotificationPreferencesRoute = apiRoute({
  body: notificationPreferencesSchema,
  handler: async ({ body, auth }) => jsonOk(await updatePreferences(auth.user.id, body)),
});
