"use client";

import { useMemo } from "react";

import { useI18n } from "@/components/providers/i18n-provider";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";

/** Date formatters bound to the interface language, so dates follow the FR/EN switch. */
export function useFormatters() {
  const { locale } = useI18n();
  return useMemo(
    () => ({
      relative: (iso: string) => formatRelative(iso, locale),
      dateTime: (iso: string) => formatDateTime(iso, locale),
      date: (iso: string) => formatDate(iso, { locale }),
    }),
    [locale],
  );
}
