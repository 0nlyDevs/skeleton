/**
 * Upload input validation.
 *
 * The file itself cannot be described by a Zod schema — its truth is its magic
 * bytes, checked in the service — so this module covers the multipart *fields*
 * that ride alongside it. Parsing happens in the route because the shared
 * `apiRoute` body hook is JSON-only; a multipart request is read once, here.
 */

import { z } from "zod";

export const uploadVisibilitySchema = z.enum(["PUBLIC", "PRIVATE"]).default("PRIVATE");

export type UploadVisibilityInput = z.infer<typeof uploadVisibilitySchema>;
