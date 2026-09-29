import {
  deletePostRoute,
  getPostRoute,
  updatePostRoute,
} from "@/modules/posts/posts.routes";

export const GET = getPostRoute;
export const PATCH = updatePostRoute;
export const DELETE = deletePostRoute;
