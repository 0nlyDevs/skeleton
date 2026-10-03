/**
 * Which fields an edit actually changed, for the audit trail: "who changed
 * what" needs the field names, not only "updated". Values are compared as
 * JSON so dates, nulls and nested objects behave.
 */
export function changedFields<T extends Record<string, unknown>>(before: T, after: Partial<T>, fields: readonly (keyof T & string)[]): string[] {
  const normalize = (value: unknown) => JSON.stringify(value instanceof Date ? value.toISOString() : (value ?? null));
  return fields.filter((field) => field in after && normalize(before[field]) !== normalize(after[field]));
}
