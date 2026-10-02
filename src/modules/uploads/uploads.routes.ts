/**
 * Upload HTTP handlers.
 *
 * Thin by construction: `apiRoute` has already authenticated the caller and
 * enforced the rate limit, so each handler is one parse + one call into the
 * service. Multipart bodies are the one thing `apiRoute` does not parse — its
 * body hook is JSON-only — so the form is read here, once, and the file is
 * handed to the service as bytes.
 */

import { NextResponse } from "next/server";

import { apiRoute, publicRoute } from "@/lib/api/route";
import { jsonCreated } from "@/lib/api/response";
import { env } from "@/lib/env";
import { BadRequestError, PayloadTooLargeError } from "@/lib/errors";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { idSchema, parseOrThrow } from "@/lib/validate";

import { uploadVisibilitySchema } from "./uploads.schema";
import { getFileForViewer, uploadFileForActor } from "./uploads.service";

import { z } from "zod";

const uploadIdParamSchema = z.object({ id: idSchema });

/**
 * Read the multipart body exactly once — a request stream cannot be consumed
 * twice — and split it into the file part and the visibility field.
 */
async function readUploadForm(request: Request): Promise<{
  readonly file: { readonly filename: string; readonly bytes: Buffer };
  readonly visibility: "PUBLIC" | "PRIVATE";
}> {
  // Checked before parsing: `formData()` would otherwise buffer any size.
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (!declared || declared > env.UPLOAD_MAX_BYTES + 64 * 1024) {
    throw new PayloadTooLargeError(`The uploaded file exceeds the ${env.UPLOAD_MAX_BYTES} byte limit.`);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new BadRequestError("The request must be a multipart/form-data upload.");
  }

  const part = form.get("file");
  if (!(part instanceof File)) {
    throw new BadRequestError('A "file" part is required.');
  }

  const visibility = parseOrThrow(uploadVisibilitySchema, form.get("visibility") ?? undefined);

  return {
    file: { filename: part.name, bytes: Buffer.from(await part.arrayBuffer()) },
    visibility,
  };
}

export const uploadFileRoute = apiRoute({
  rateLimit: RATE_LIMITS.upload,
  handler: async ({ request, auth, ip }) => {
    const { file, visibility } = await readUploadForm(request);
    const dto = await uploadFileForActor({ ...file, visibility }, { user: auth.user, ip });
    return jsonCreated({ data: dto });
  },
});

export const serveFileRoute = publicRoute({
  params: uploadIdParamSchema,
  handler: async ({ params, auth }) => {
    const file = await getFileForViewer(params.id, auth?.user ?? null);

    return new NextResponse(new Uint8Array(file.bytes), {
      status: 200,
      headers: {
        "Content-Type": file.mime,
        "Content-Length": String(file.bytes.byteLength),
        "X-Content-Type-Options": "nosniff",
        // Defence in depth: even if a file were ever interpreted as a document,
        // it could run nothing and reach nothing.
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
        "Content-Disposition": file.mime.startsWith("image/") ? "inline" : "attachment",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Cache-Control":
          file.visibility === "PRIVATE" ? "private, max-age=300" : "public, max-age=86400, immutable",
      },
    });
  },
});
