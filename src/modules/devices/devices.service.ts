/**
 * New-device sign-in detection ("Est-ce bien vous ?").
 *
 * Each browser gets a random, HttpOnly device cookie on its first sign-in;
 * only its SHA-256 is stored. A sign-in from a browser without a known cookie
 * — on an account that already has known devices — creates a SECURITY
 * notification and an email (always sent, whatever the email preferences)
 * pointing to the security page, where every other session can be revoked.
 */

import { createHash, randomBytes } from "node:crypto";

import { FROZEN_IDENTIFIERS } from "@/lib/brand";
import { prisma } from "@/lib/db/prisma";
import { describeUserAgent } from "@/lib/http/user-agent";
import { logger } from "@/lib/logger";

import { createNotification } from "../notifications/notifications.service";

export const DEVICE_COOKIE = FROZEN_IDENTIFIERS.DEVICE_COOKIE;
/** About 400 days, the longest lifetime browsers honour. */
export const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

const DEVICE_ID = /^[A-Za-z0-9_-]{32,64}$/;

function hash(deviceId: string): string {
  return createHash("sha256").update(deviceId).digest("hex");
}

export function newDeviceId(): string {
  return randomBytes(32).toString("base64url");
}

export function isDeviceId(value: string | null | undefined): value is string {
  return typeof value === "string" && DEVICE_ID.test(value);
}

/**
 * Record a sign-in from `deviceId` and alert on a new device. Never throws:
 * a failure here must not block a legitimate sign-in.
 */
export async function recordSignIn(input: {
  userId: string;
  deviceId: string;
  userAgent: string | null;
  ip: string | null;
}): Promise<void> {
  try {
    const deviceHash = hash(input.deviceId);
    const { browser, os } = describeUserAgent(input.userAgent);
    const label = `${browser} · ${os}`.slice(0, 120);

    const existing = await prisma.knownDevice.findUnique({
      where: { userId_deviceHash: { userId: input.userId, deviceHash } },
      select: { id: true },
    });
    if (existing) {
      await prisma.knownDevice.update({ where: { id: existing.id }, data: { lastSeenAt: new Date(), lastIp: input.ip } });
      return;
    }

    const knownCount = await prisma.knownDevice.count({ where: { userId: input.userId } });
    await prisma.knownDevice.create({ data: { userId: input.userId, deviceHash, label, lastIp: input.ip } });

    // The very first device is the account's own creation, not an intrusion.
    if (knownCount === 0) return;

    const when = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }).format(new Date());
    await createNotification({
      userId: input.userId,
      type: "SECURITY",
      title: "Nouvelle connexion à votre compte — est-ce bien vous ?",
      body: `${browser} sur ${os}${input.ip ? ` · IP ${input.ip}` : ""} · ${when} (UTC). Si ce n'était pas vous, déconnectez les autres appareils et changez votre mot de passe.`,
      link: "/settings/security?alert=new-device",
      email: true,
    });
  } catch (error) {
    logger.warn("device tracking failed", { userId: input.userId, error });
  }
}
