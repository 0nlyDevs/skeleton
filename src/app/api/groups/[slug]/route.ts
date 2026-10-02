import { deleteGroupRoute, getGroupRoute, updateGroupRoute } from "@/modules/groups/groups.routes";

export const GET = getGroupRoute;
export const PATCH = updateGroupRoute;
export const DELETE = deleteGroupRoute;
