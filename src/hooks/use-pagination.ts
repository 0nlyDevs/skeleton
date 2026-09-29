"use client";

import { useCallback, useMemo, useState } from "react";

import type { ListMeta } from "@/types";

export interface PaginationState {
  readonly page: number;
  readonly limit: number;
  readonly meta: ListMeta | null;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setMeta: (meta: ListMeta | null) => void;
  next: () => void;
  previous: () => void;
  reset: () => void;
  /** `true` when there is nowhere further to go in either direction. */
  readonly isSinglePage: boolean;
}

/**
 * Pagination state for a client-rendered list.
 *
 * Changing the page size resets to page 1: staying on page 7 while switching to
 * 10 rows can land on an empty page, which reads as a bug to a jury.
 */
export function usePagination(initial: { page?: number; limit?: number } = {}): PaginationState {
  const initialPage = initial.page ?? 1;
  const initialLimit = initial.limit ?? 20;

  const [page, setPageInternal] = useState(initialPage);
  const [limit, setLimitInternal] = useState(initialLimit);
  const [meta, setMeta] = useState<ListMeta | null>(null);

  const setPage = useCallback((next: number) => {
    setPageInternal(Math.max(1, next));
  }, []);

  const setLimit = useCallback((next: number) => {
    setLimitInternal(Math.max(1, next));
    setPageInternal(1);
  }, []);

  const next = useCallback(() => {
    setPageInternal((current) => current + 1);
  }, []);

  const previous = useCallback(() => {
    setPageInternal((current) => Math.max(1, current - 1));
  }, []);

  const reset = useCallback(() => {
    setPageInternal(initialPage);
    setLimitInternal(initialLimit);
  }, [initialPage, initialLimit]);

  return useMemo(
    () => ({
      page,
      limit,
      meta,
      setPage,
      setLimit,
      setMeta,
      next,
      previous,
      reset,
      isSinglePage: (meta?.totalPages ?? 1) <= 1,
    }),
    [page, limit, meta, setPage, setLimit, next, previous, reset],
  );
}
