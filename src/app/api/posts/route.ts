import { createPostRoute, listPostsRoute } from "@/modules/posts/posts.routes";

export const GET = listPostsRoute;
export const POST = createPostRoute;
