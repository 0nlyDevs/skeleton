"use client";

import { useId, type ComponentProps, type ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Form field wrapper.
 *
 * The point of this component is the wiring: the label is associated with the
 * control, the hint and the error are connected through `aria-describedby`, and
 * the control gets `aria-invalid`. Doing that by hand in every form is how
 * accessibility quietly disappears from a codebase under time pressure.
 *
 * It renders the label, the control and the messages; the caller supplies the
 * control and gets the generated id through a render prop.
 */
export function FormField({
  label,
  hint,
  error,
  required,
  className,
  children,
  htmlFor,
}: {
  readonly label?: string;
  readonly hint?: string;
  readonly error?: string;
  readonly required?: boolean;
  readonly className?: string;
  readonly htmlFor?: string;
  readonly children: (props: {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby": string | undefined;
  }) => ReactNode;
}) {
  const generatedId = useId();
  const id = htmlFor ?? `field-${generatedId}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label ? (
        <Label htmlFor={id}>
          {label}
          {required ? (
            <span className="text-error" aria-hidden>
              *
            </span>
          ) : null}
        </Label>
      ) : null}

      {children({
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby": describedBy,
      })}

      {hint && !error ? (
        <p id={hintId} className="text-[12px] leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} className="text-[12px] font-medium leading-relaxed text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Standalone field error, for inputs that are not wrapped in a FormField. */
export function FieldError({
  message,
  className,
}: {
  readonly message?: string;
  readonly className?: string;
}) {
  if (!message) return null;
  return (
    <p role="alert" className={cn("text-[12px] font-medium leading-relaxed text-error", className)}>
      {message}
    </p>
  );
}

/** Small helper row used under inputs, e.g. a character counter. */
export function FieldMeta({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center justify-between gap-2 text-[12px] text-muted-foreground", className)}
      {...props}
    />
  );
}
