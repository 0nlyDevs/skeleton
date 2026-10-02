/** PUT joins (or requests to join); DELETE leaves. */
import { joinGroupRoute, leaveGroupRoute } from "@/modules/groups/groups.routes";

export const PUT = joinGroupRoute;
export const DELETE = leaveGroupRoute;
