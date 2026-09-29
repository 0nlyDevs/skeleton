import { listMessagesRoute, sendMessageRoute } from "@/modules/messages/messages.routes";

/**
 * GET is the realtime polling fallback: `?room=<id>&since=<iso-cursor>`.
 * POST is the HTTP path for sending; both it and the socket event call the same
 * service, so the rate limit and the fan-out are identical.
 */
export const GET = listMessagesRoute;
export const POST = sendMessageRoute;
