/**
 * Password hashing.
 *
 * Primary algorithm: **argon2id** (OWASP parameters) through `@node-rs/argon2`,
 * which ships prebuilt binaries — no node-gyp on the hosting box.
 *
 * Fallback: if the native binding cannot be loaded at runtime (an exotic
 * platform or a stripped `node_modules`), the module degrades to Node's built-in
 * `scrypt` instead of taking authentication down with it. Hashes are
 * self-describing (`$argon2…` / `scrypt$…`), so both verify correctly and a
 * deployment that later gains argon2 keeps serving existing passwords.
 *
 * `@node-rs/argon2` is listed in `serverExternalPackages` so the bundler never
 * tries to inline a `.node` binary.
 */

import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto";

import { logger } from "@/lib/logger";

/** OWASP recommended argon2id parameters (19 MiB, t=2, p=1). */
const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

const SCRYPT_PARAMS = { N: 16_384, r: 8, p: 1 } as const;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_PREFIX = "scrypt";

interface Argon2Module {
  hash(password: string, options?: Record<string, unknown>): Promise<string>;
  verify(hashed: string, password: string, options?: Record<string, unknown>): Promise<boolean>;
}

let argon2Loader: Promise<Argon2Module | null> | undefined;

function loadArgon2(): Promise<Argon2Module | null> {
  argon2Loader ??= import("@node-rs/argon2")
    .then((module) => module as unknown as Argon2Module)
    .catch((error: unknown) => {
      logger.warn(
        "argon2 unavailable, falling back to scrypt; existing argon2 hashes will not verify on this host",
        { error },
      );
      return null;
    });

  return argon2Loader;
}

function scryptAsync(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

/**
 * `scrypt$N$r$p$saltB64$keyB64` — every parameter needed to verify is stored
 * with the hash, so parameters can be raised later without breaking old rows.
 */
async function hashWithScrypt(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, SCRYPT_KEY_LENGTH, {
    ...SCRYPT_PARAMS,
    maxmem: 64 * 1024 * 1024,
  });

  return [
    SCRYPT_PREFIX,
    SCRYPT_PARAMS.N,
    SCRYPT_PARAMS.r,
    SCRYPT_PARAMS.p,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

async function verifyWithScrypt(hash: string, password: string): Promise<boolean> {
  const parts = hash.split("$");
  if (parts.length !== 6) return false;

  const [, rawN, rawR, rawP, rawSalt, rawKey] = parts;
  const N = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(rawSalt ?? "", "base64");
    expected = Buffer.from(rawKey ?? "", "base64");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  try {
    const derived = await scryptAsync(password, salt, expected.length, {
      N,
      r,
      p,
      maxmem: 128 * 1024 * 1024,
    });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** Hash a plaintext password for storage in `Account.password`. */
export async function hashPassword(password: string): Promise<string> {
  const argon2 = await loadArgon2();
  if (argon2) return argon2.hash(password, ARGON2_OPTIONS);
  return hashWithScrypt(password);
}

/**
 * Verify a password against a stored hash. Never throws: a malformed hash is a
 * failed verification, not a server error, so callers cannot leak the
 * difference between "bad password" and "corrupt row".
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  if (hash.startsWith("$argon2")) {
    const argon2 = await loadArgon2();
    if (!argon2) return false;
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  if (hash.startsWith(`${SCRYPT_PREFIX}$`)) {
    return verifyWithScrypt(hash, password);
  }

  return false;
}

/** Generate a high-entropy password for seeded demo and jury accounts. */
export function generateStrongPassword(length = 20): string {
  // 64-character alphabet: 6 bits per character, so 20 characters ≈ 120 bits.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const bytes = randomBytes(length);
  let output = "";
  for (let index = 0; index < length; index += 1) {
    output += alphabet[(bytes[index] ?? 0) % alphabet.length];
  }
  return output;
}
