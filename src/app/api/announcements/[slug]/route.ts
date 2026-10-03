import { deleteAnnouncementRoute, getAnnouncementRoute, updateAnnouncementRoute } from "@/modules/announcements/announcements.routes";

export const GET = getAnnouncementRoute;
export const PUT = updateAnnouncementRoute;
export const DELETE = deleteAnnouncementRoute;
