import { createAnnouncementRoute, listAnnouncementsRoute } from "@/modules/announcements/announcements.routes";

export const GET = listAnnouncementsRoute;
export const POST = createAnnouncementRoute;
