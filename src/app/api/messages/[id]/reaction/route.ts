import { listMessageReactorsRoute, removeMessageReactionRoute, setMessageReactionRoute } from "@/modules/messages/messages.routes";

export const GET = listMessageReactorsRoute;
export const PUT = setMessageReactionRoute;
export const DELETE = removeMessageReactionRoute;
