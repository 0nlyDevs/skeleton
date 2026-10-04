/**
 * F71 — accounts for residents without an email address, created with an
 * agent. The agent enters names; each resident gets a readable username and a
 * one-time access code printed on a sheet (with a QR code to the sign-in page).
 * At first sign-in the resident must choose their own password or passkey: the
 * printed code only opens the door once.
 *
 * The code is generated on the server, shown once in the response, and only
 * its hash is stored, like any password.
 */

import { randomInt, randomUUID } from "node:crypto";

import { placeholderEmail } from "@/lib/accounts/no-email";
import { isAdmin, isStaff } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { ConflictError, ForbiddenError } from "@/lib/errors";
import { composeDisplayName, usernameViolation } from "@/lib/validation/profile";
import type { AuthUser } from "@/types";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";
import { baseUsername, newAccessCode } from "./assisted-accounts.codes";
import type { AdminCreateAccountInput, CreateAssistedAccountsInput } from "./assisted-accounts.schema";

export interface AssistedAccountDto {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  /** Shown once, to be printed; never stored in clear and never shown again. */
  readonly accessCode: string;
}

export async function uniqueUsername(firstName: string, lastName: string): Promise<string> {
  const base = baseUsername(firstName, lastName);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}${randomInt(10, 9999)}`;
    if (usernameViolation(candidate)) continue;
    const taken = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `habitant${randomInt(100_000, 999_999)}`;
}

export async function createAssistedAccounts(
  input: CreateAssistedAccountsInput,
  actor: AuthUser,
  ip: string | null,
): Promise<AssistedAccountDto[]> {
  if (!isStaff(actor)) throw new ForbiddenError("Only city agents can create accounts for residents.");

  const created: AssistedAccountDto[] = [];
  for (const resident of input.residents) {
    const username = await uniqueUsername(resident.firstName, resident.lastName);
    const accessCode = newAccessCode();
    const id = randomUUID();
    const name = composeDisplayName(resident.firstName, resident.lastName);
    await prisma.user.create({
      data: {
        id,
        name,
        firstName: resident.firstName,
        lastName: resident.lastName,
        email: placeholderEmail(username),
        // Nothing to verify: there is no mailbox, and the agent met the person.
        emailVerified: true,
        username,
        displayUsername: username,
        role: "USER",
        noEmail: true,
        mustSetSecret: true,
        preferredLocale: input.locale,
        accounts: {
          create: {
            id: randomUUID(),
            // BetterAuth's credential sign-in requires accountId === user id.
            accountId: id,
            providerId: "credential",
            password: await hashPassword(accessCode),
          },
        },
      },
    });
    await recordAudit({
      actorId: actor.id,
      action: auditActions.assistedAccountCreated,
      targetType: "user",
      targetId: id,
      metadata: { username, locale: input.locale },
      ip,
    });
    created.push({ id, name, username, accessCode });
  }
  return created;
}

/** The resident chose their own password or passkey: the printed code is no longer the way in. */
export async function clearMustSetSecret(userId: string): Promise<void> {
  await prisma.user.updateMany({ where: { id: userId, mustSetSecret: true }, data: { mustSetSecret: false } });
}

export interface AdminCreatedAccountDto extends AssistedAccountDto {
  readonly role: "USER" | "AGENT" | "ADMIN";
  readonly email: string | null;
}

/**
 * An administrator creates an account of any role (resident, agent,
 * administrator), with or without an e-mail address. The person gets a
 * username and a one-time access code, and must choose their own password or
 * passkey at first sign-in. The role is set here on the server, never by the
 * person themselves.
 */
export async function createAccountAsAdmin(input: AdminCreateAccountInput, actor: AuthUser, ip: string | null): Promise<AdminCreatedAccountDto> {
  if (!isAdmin(actor)) throw new ForbiddenError("Only administrators can create accounts with a role.");
  const email = input.email ?? null;
  if (email && (await prisma.user.findUnique({ where: { email }, select: { id: true } }))) {
    throw new ConflictError("An account already uses this e-mail address.");
  }
  const username = await uniqueUsername(input.firstName, input.lastName);
  const accessCode = newAccessCode();
  const id = randomUUID();
  const name = composeDisplayName(input.firstName, input.lastName);
  await prisma.user.create({
    data: {
      id,
      name,
      firstName: input.firstName,
      lastName: input.lastName,
      email: email ?? placeholderEmail(username),
      // Created by an administrator who knows the person: nothing left to verify.
      emailVerified: true,
      username,
      displayUsername: username,
      role: input.role,
      noEmail: email === null,
      mustSetSecret: true,
      preferredLocale: input.locale,
      ...(input.cityZone ? { cityZone: input.cityZone } : {}),
      accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password: await hashPassword(accessCode) } },
    },
  });
  await recordAudit({ actorId: actor.id, action: auditActions.userCreatedByAdmin, targetType: "user", targetId: id, metadata: { op: "create", name, username, role: input.role, withEmail: email !== null }, ip });
  return { id, name, username, accessCode, role: input.role, email };
}
