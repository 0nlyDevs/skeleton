import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

import { syncWebcupFeed } from "./webcup.service";

/**
 * Poll the Terra Nova API from the server (the API never pushes). The
 * interval comes from `WEBCUP_POLL_SECONDS`; errors are stored by the sync
 * and the loop simply tries again at the next tick.
 */
export function startWebcupPoller(): () => void {
  if (!env.WEBCUP_API_KEY) {
    logger.info("webcup poller disabled (no WEBCUP_API_KEY)");
    return () => undefined;
  }
  const tick = () => {
    void syncWebcupFeed().then((result) => {
      if (result.added.length > 0) logger.info("webcup feed: new requests", { added: result.added });
      if (!result.ok) logger.warn("webcup feed unavailable", { error: result.error });
    });
  };
  const first = setTimeout(tick, 5_000);
  const timer = setInterval(tick, env.WEBCUP_POLL_SECONDS * 1_000);
  timer.unref?.();
  first.unref?.();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
