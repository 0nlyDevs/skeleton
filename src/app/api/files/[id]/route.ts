import { serveFileRoute } from "@/modules/uploads/uploads.routes";

/**
 * Serves a stored file after re-checking authorization on every request.
 * Files live outside the web root, so this route is the only way in.
 */
export const GET = serveFileRoute;
