/**
 * Validation helpers.
 *
 * One rule drives this module: **nothing reaches a service unvalidated**. Body,
 * query and path parameters are parsed through a schema, and a failure becomes a
 * `VALIDATION_ERROR` with per-field messages the UI can render next to the
 * offending input.
 *
 * Shared field schemas live here too, so `email` means the same thing in the
 * register form, the admin search box and the seed script.
 */

import { z } from "zod";

import { BadRequestError, ValidationError, type FieldErrors } from "./errors";

/** Pragmatic pattern: one `@`, a dotted domain, no whitespace. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

const MAX_EMAIL_LENGTH = 254;

/**
 * Canonical email input. Trims, lowercases, then validates — in that order, so
 * `"  Ada@Example.COM "` is accepted and stored consistently. Deliberately not
 * using `z.string().email()`: the built-in check has changed shape between Zod
 * majors, and an auth schema is not the place to absorb that churn.
 */
export const emailSchema = z
  .string()
  .max(MAX_EMAIL_LENGTH * 2, "This email address is too long.")
  .transform((value) => value.trim().toLowerCase())
  .refine((value) => value.length <= MAX_EMAIL_LENGTH, "This email address is too long.")
  .refine((value) => EMAIL_PATTERN.test(value), "Enter a valid email address.");

export const nameSchema = z
  .string()
  .transform((value) => value.trim().replace(/\s+/g, " "))
  .refine((value) => value.length >= 2, "Please use at least 2 characters.")
  .refine((value) => value.length <= 80, "Please use at most 80 characters.");

export const shortTextSchema = (max: number, label = "This field") =>
  z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, `${label} is required.`)
    .refine((value) => value.length <= max, `${label} must be at most ${max} characters.`);

export const longTextSchema = (max: number, label = "This field") =>
  z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length <= max, `${label} must be at most ${max} characters.`);

/** Cuid/cuid2 identifiers used by our own models. */
export const idSchema = z
  .string()
  .trim()
  .min(1, "Missing identifier.")
  .max(64, "Invalid identifier.");

/** Query-string booleans: `?published=true`. */
export const booleanQuerySchema = z
  .union([z.literal("true"), z.literal("false"), z.literal("1"), z.literal("0")])
  .transform((value) => value === "true" || value === "1");

/** Collapse a Zod failure into `{ field: message }` for the error contract. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const fields: FieldErrors = {};

  for (const issue of error.issues) {
    const path = issue.path
      .map((segment) => String(segment))
      .filter((segment) => segment.length > 0)
      .join(".");

    const key = path.length > 0 ? path : "_root";
    // First message wins: it is the most specific one Zod produced.
    if (!(key in fields)) fields[key] = issue.message;
  }

  return fields;
}

export type ValidationScope = "body" | "query" | "params" | "input";

const SCOPE_LABEL: Record<ValidationScope, string> = {
  body: "request body",
  query: "query parameters",
  params: "URL parameters",
  input: "input",
};

/** Parse or throw a 400 carrying field-level detail. */
export function parseOrThrow<T>(
  schema: z.ZodType<T>,
  input: unknown,
  scope: ValidationScope = "input",
): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new ValidationError(
      toFieldErrors(result.error),
      `The ${SCOPE_LABEL[scope]} is invalid.`,
    );
  }

  return result.data;
}

/** Keys of a Zod object schema — used by API routes that must not read more. */
export function schemaKeys(schema: z.ZodObject<z.ZodRawShape>): string[] {
  return Object.keys(schema.shape);
}

/**
 * Read a JSON body.
 *
 * An empty body is `{}` so that an endpoint with only optional fields does not
 * require the client to send one; malformed JSON is a 400, never a 500.
 */
export async function parseJsonBody(request: Request): Promise<unknown> {
  let raw: string;
  try {
    raw = await request.text();
  } catch (error) {
    throw new BadRequestError(`Could not read the request body: ${String(error)}`);
  }

  if (raw.trim().length === 0) return {};

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new BadRequestError("The request body is not valid JSON.");
  }
}

/**
 * Guard for PATCH-style schemas: reject an update that changes nothing.
 *
 * Written as `Object.values(...).some(v => v !== undefined)` rather than
 * `Object.keys(...).length > 0` on purpose: a schema field carrying a `.default()`
 * materializes a key even when the client sent nothing, which would make an
 * empty PATCH look like a real update.
 */
export function hasAtLeastOneDefined(value: Record<string, unknown>): boolean {
  return Object.values(value).some((entry) => entry !== undefined);
}

/** Turn a `URLSearchParams` into a plain object for schema parsing. */
export function searchParamsToObject(searchParams: URLSearchParams): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    // Repeated keys keep the first value: matches user intent and keeps the
    // parsed shape flat, which every schema here expects.
    if (!(key in output)) output[key] = value;
  }
  return output;
}
