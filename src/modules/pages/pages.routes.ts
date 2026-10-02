import QRCode from "qrcode";
import { z } from "zod";

import { apiRoute, publicRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { env } from "@/lib/env";

import { createPageSchema, listPagesQuerySchema, pageSlugParamSchema, updatePageSchema } from "./pages.schema";
import { createPage, deletePage, getPage, likePage, listPages, pageUrl, updatePage } from "./pages.service";

export const listPagesRoute = publicRoute({
  query: listPagesQuerySchema,
  handler: async ({ query, auth }) => jsonOk(await listPages(query, auth?.user ?? null)),
});

export const createPageRoute = apiRoute({
  body: createPageSchema,
  handler: async ({ body, auth, ip }) => jsonOk({ data: await createPage(body, { user: auth.user, ip }) }, 201),
});

export const getPageRoute = publicRoute({
  params: pageSlugParamSchema,
  handler: async ({ params, auth, ip }) => jsonOk({ data: await getPage(params.slug, auth?.user ?? null, auth?.user.id ?? ip) }),
});

export const updatePageRoute = apiRoute({
  params: pageSlugParamSchema,
  body: updatePageSchema,
  handler: async ({ params, body, auth, ip }) => jsonOk({ data: await updatePage(params.slug, body, { user: auth.user, ip }) }),
});

export const deletePageRoute = apiRoute({
  params: pageSlugParamSchema,
  query: z.object({ reason: z.string().trim().max(300).optional() }),
  handler: async ({ params, query, auth, ip }) => {
    await deletePage(params.slug, { user: auth.user, ip }, query.reason ?? null);
    return jsonOk({ data: { deleted: true } });
  },
});

export const likePageRoute = apiRoute({
  params: pageSlugParamSchema,
  handler: async ({ params, auth, request }) => jsonOk({ data: await likePage(params.slug, request.method === "PUT", auth.user) }),
});

/** QR code (SVG) of the page's public address, for posters and phones. */
export const pageQrRoute = publicRoute({
  params: pageSlugParamSchema,
  handler: async ({ params, auth }) => {
    const url = await pageUrl(params.slug, auth?.user ?? null, env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, ""));
    const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
    return new Response(svg, {
      headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "private, max-age=300", "x-content-type-options": "nosniff" },
    });
  },
});
