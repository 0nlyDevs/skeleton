/** Eco mode cookie: `1` turns light mode on, `0` keeps the full page even on a slow link. */
export const ECO_COOKIE = "skeleton_eco";
/** Set for a day when the browser reports a slow or metered connection. */
export const ECO_AUTO_COOKIE = "skeleton_eco_auto";

/** Network Information effective types that make a page painful to load. */
const SLOW_CONNECTIONS = new Set(["slow-2g", "2g", "3g"]);

export interface EcoSignals {
  /** `ECO_COOKIE`: the resident's explicit choice, when they made one. */
  readonly choice: string | undefined;
  readonly autoCookie: string | undefined;
  /** `Save-Data` request header. */
  readonly saveData: string | null;
  /** `ECT` client hint (effective connection type). */
  readonly ect: string | null;
}

export interface EcoMode {
  readonly on: boolean;
  /** Switched on for the resident because the connection is slow. */
  readonly auto: boolean;
}

/**
 * Data saving, or an effective connection type of 3G or worse. The raw
 * `Downlink` estimate is deliberately ignored: right after start-up Chrome
 * reports it below 1 Mbit/s even on a fast link, which would put healthy
 * connections in light mode.
 */
export function isSlowConnection(saveData: string | null, ect: string | null): boolean {
  if (saveData?.toLowerCase() === "on") return true;
  return ect !== null && SLOW_CONNECTIONS.has(ect.toLowerCase());
}

/**
 * Light mode is on when the resident asked for it, or when the connection is
 * slow and they have not asked for the full page. An explicit choice always
 * wins, so nobody is stuck in a mode they turned off.
 */
export function resolveEcoMode(signals: EcoSignals): EcoMode {
  if (signals.choice === "1") return { on: true, auto: false };
  if (signals.choice === "0") return { on: false, auto: false };
  const slow = signals.autoCookie === "1" || isSlowConnection(signals.saveData, signals.ect);
  return { on: slow, auto: slow };
}

/**
 * Runs in `<head>` before the first paint, for browsers that do not send the
 * client hints: if the connection looks slow and the resident made no choice,
 * switch the page to light mode now and remember it for a day, so the next
 * pages are served light from the first byte.
 */
export const ECO_AUTO_SCRIPT = `(function(){try{var d=document.documentElement,c=document.cookie;if(/(?:^|; )${ECO_COOKIE}=/.test(c))return;var n=navigator.connection;if(!n)return;var slow=n.saveData||["slow-2g","2g","3g"].indexOf(n.effectiveType)>=0;if(!slow)return;d.setAttribute("data-eco","");d.setAttribute("data-eco-auto","");document.cookie="${ECO_AUTO_COOKIE}=1; Path=/; Max-Age=86400; SameSite=Lax"}catch(e){}})();`;
