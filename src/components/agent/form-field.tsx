import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";

export const SELECT_CLASS =
  "h-10 w-full rounded-[var(--radius-control)] border border-input bg-surface px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

/** Label, control and the server's message for that field. */
export function FormField({
  id,
  label,
  error,
  children,
}: {
  readonly id: string;
  readonly label: string;
  readonly error?: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p id={`${id}-error`} className="text-[0.7812rem] text-error">{error}</p> : null}
    </div>
  );
}
