import { cookies } from "next/headers";
import { z } from "zod";

import { apiRoute } from "@/lib/api/route";
import { jsonOk, noContent } from "@/lib/api/response";
import { NotFoundError } from "@/lib/errors";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";
import { DEVICE_COOKIE, forgetKnownDevice, listKnownDevices, ownsKnownDevice } from "./devices.service";

const deviceParamSchema = z.object({ id: z.string().trim().min(1).max(64) });

/** `GET /api/users/me/devices` — F54: the caller's recognised devices. */
export const listMyDevicesRoute = apiRoute({
  handler: async ({ auth }) => {
    const current = (await cookies()).get(DEVICE_COOKIE)?.value ?? null;
    return jsonOk({ data: await listKnownDevices(auth.user.id, current) });
  },
});

/** `DELETE /api/users/me/devices/:id` — forget a device; its next sign-in raises the alert again. */
export const forgetMyDeviceRoute = apiRoute({
  params: deviceParamSchema,
  handler: async ({ params, auth, ip }) => {
    if (!(await forgetKnownDevice(auth.user.id, params.id))) throw new NotFoundError("That device does not exist.");
    await recordAudit({ actorId: auth.user.id, action: auditActions.deviceForgotten, targetType: "user", targetId: auth.user.id, metadata: { deviceId: params.id }, ip });
    return noContent();
  },
});

/** `POST /api/users/me/devices/:id/confirm` — "yes, it was me" from the new-device alert. */
export const confirmMyDeviceRoute = apiRoute({
  params: deviceParamSchema,
  handler: async ({ params, auth, ip }) => {
    if (!(await ownsKnownDevice(auth.user.id, params.id))) throw new NotFoundError("That device does not exist.");
    await recordAudit({ actorId: auth.user.id, action: auditActions.deviceConfirmed, targetType: "user", targetId: auth.user.id, metadata: { deviceId: params.id }, ip });
    return jsonOk({ confirmed: true });
  },
});
