import { apiRoute, publicRoute } from "@/lib/api/route";
import { jsonOk, noContent } from "@/lib/api/response";

import { announcementInputSchema, announcementSlugParamSchema, listAnnouncementsQuerySchema } from "./announcements.schema";
import { createAnnouncement, deleteAnnouncement, getAnnouncement, listAnnouncements, updateAnnouncement } from "./announcements.service";

export const listAnnouncementsRoute = publicRoute({
  query: listAnnouncementsQuerySchema,
  handler: async ({ query, auth }) => jsonOk(await listAnnouncements(query, auth?.user ?? null)),
});

export const getAnnouncementRoute = publicRoute({
  params: announcementSlugParamSchema,
  handler: async ({ params, auth }) => jsonOk({ data: await getAnnouncement(params.slug, auth?.user ?? null) }),
});

export const createAnnouncementRoute = apiRoute({
  roles: ["AGENT", "ADMIN"],
  body: announcementInputSchema,
  handler: async ({ body, auth, ip }) => jsonOk({ data: await createAnnouncement(body, auth.user, ip) }, 201),
});

export const updateAnnouncementRoute = apiRoute({
  roles: ["AGENT", "ADMIN"],
  params: announcementSlugParamSchema,
  body: announcementInputSchema,
  handler: async ({ params, body, auth, ip }) => jsonOk({ data: await updateAnnouncement(params.slug, body, auth.user, ip) }),
});

export const deleteAnnouncementRoute = apiRoute({
  roles: ["AGENT", "ADMIN"],
  params: announcementSlugParamSchema,
  handler: async ({ params, auth, ip }) => {
    await deleteAnnouncement(params.slug, auth.user, ip);
    return noContent();
  },
});
