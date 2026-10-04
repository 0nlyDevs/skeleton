/**
 * The largest file a resident may send, in bytes. The server enforces it
 * (`UPLOAD_MAX_BYTES`, 5 MB unless changed); the browser checks it first so a
 * file that is too large is refused with the real reason, instead of a
 * connection that the server closes half-way and the page calls "offline".
 */
export const UPLOAD_LIMIT_BYTES = 5 * 1024 * 1024;
