import { listReactorsRoute, removeReactionRoute, setReactionRoute } from "@/modules/reactions/reactions.routes";

export const GET = listReactorsRoute;
export const PUT = setReactionRoute;
export const DELETE = removeReactionRoute;
