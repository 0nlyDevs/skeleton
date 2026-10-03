/** Normalize search text so visible-list filters behave consistently. */
export function normalizeSearchText(value: string): string {
  return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Case- and accent-insensitive substring match across the supplied fields. */
export function matchesSearch(
  values: readonly (string | null | undefined)[],
  query: string,
): boolean {
  const term = normalizeSearchText(query.trim());
  return !term || values.some((value) => value != null && normalizeSearchText(value).includes(term));
}
