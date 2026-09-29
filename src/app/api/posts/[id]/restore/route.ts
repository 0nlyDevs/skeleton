import { restorePostRoute } from "@/modules/posts/posts.routes";

/** Staff-only: undo a soft delete from the moderation queue. */
export const POST = restorePostRoute;
