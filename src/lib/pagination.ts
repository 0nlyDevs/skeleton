/**
 * Offset pagination and sort whitelisting.
 *
 * Two rules keep this safe:
 *   1. `limit` is capped server-side, so `?limit=100000` cannot be used to
 *      exfiltrate a table in one request.
 *   2. Sort fields are resolved against an explicit allowlist, so user input is
 *      never interpolated into an `orderBy` clause.
 */

import { z } from "zod";

export const PAGINATION_DEFAULT_LIMIT = 20;
export const PAGINATION_MAX_LIMIT = 100;

export const sortOrderSchema = z.enum(["asc", "desc"]);

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION_MAX_LIMIT)
    .default(PAGINATION_DEFAULT_LIMIT),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type SortOrder = z.infer<typeof sortOrderSchema>;

export interface Pagination {
  readonly page: number;
  readonly limit: number;
  /** Prisma `skip`. */
  readonly skip: number;
  /** Prisma `take`. */
  readonly take: number;
}

export interface PageMeta {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
}

export interface Paginated<T> {
  readonly data: readonly T[];
  readonly meta: PageMeta;
}

export function toPagination(input: PaginationQuery): Pagination {
  const limit = Math.min(Math.max(1, input.limit), PAGINATION_MAX_LIMIT);
  const page = Math.max(1, input.page);
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

export function buildPageMeta(input: {
  page: number;
  limit: number;
  total: number;
}): PageMeta {
  const total = Math.max(0, input.total);
  const limit = Math.max(1, input.limit);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(Math.max(1, input.page), totalPages);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

/** Assemble the canonical list envelope used by every collection endpoint. */
export function paginate<T>(
  items: readonly T[],
  input: { page: number; limit: number; total: number },
): Paginated<T> {
  return { data: items, meta: buildPageMeta(input) };
}

/**
 * Resolve a requested sort field against an allowlist. Unknown values fall back
 * to `fallback` instead of erroring: the sort is a presentation concern, not a
 * security boundary, and a silent fallback keeps deep links working.
 */
export function resolveSortField<T extends string>(
  requested: string | null | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  if (!requested) return fallback;
  return (allowed as readonly string[]).includes(requested) ? (requested as T) : fallback;
}

/** Convert a sort order into Prisma's `orderBy` value. */
export function resolveSortOrder(
  requested: string | null | undefined,
  fallback: SortOrder = "desc",
): SortOrder {
  return requested === "asc" || requested === "desc" ? requested : fallback;
}
