import pkg from "../../package.json";

/**
 * Client-safe build version.
 *
 * `lib/stack.ts` is server-only (it imports `server-only`), but the admin header
 * renders on the client too, so the version constant is split out here.
 */
export const APP_VERSION: string = pkg.version;
