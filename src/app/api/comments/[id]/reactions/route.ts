import { listCommentReactorsRoute, reactToCommentRoute, removeCommentReactionRoute } from "@/modules/comments/comments.routes";

export const GET = listCommentReactorsRoute;
export const PUT = reactToCommentRoute;
export const DELETE = removeCommentReactionRoute;
