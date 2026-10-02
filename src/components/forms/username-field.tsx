"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { normalizeUsername, usernameViolation } from "@/lib/validation/profile";

export type UsernameState = "idle" | "checking" | "available" | "taken" | "invalid" | "error";

interface Availability {
  readonly available: boolean;
  readonly reason: "invalid" | "taken" | null;
}

/**
 * Username input with live availability: format is checked instantly, the
 * server is asked (debounced, cancelled when stale) only for a well-formed
 * handle. The unique index still decides on submit — two people can race.
 */
export function UsernameField({
  value,
  onChange,
  onStateChange,
  current,
  inputProps,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onStateChange?: (state: UsernameState) => void;
  /** The user's own current handle: always "available" to them. */
  readonly current?: string | null;
  readonly inputProps: { id: string; "aria-invalid": boolean; "aria-describedby": string | undefined };
}) {
  const t = useTranslation();
  const debounced = useDebouncedValue(normalizeUsername(value), 350);
  const [state, setState] = useState<UsernameState>("idle");

  useEffect(() => {
    if (!debounced) {
      setState("idle");
      return;
    }
    if (usernameViolation(debounced)) {
      setState("invalid");
      return;
    }
    if (current && debounced === current.toLowerCase()) {
      setState("available");
      return;
    }
    const controller = new AbortController();
    setState("checking");
    void apiFetch<{ data: Availability }>(`/api/users/username-availability?username=${encodeURIComponent(debounced)}`, { signal: controller.signal })
      .then((response) => setState(response.data.available ? "available" : response.data.reason === "taken" ? "taken" : "invalid"))
      .catch((error: unknown) => {
        if ((error as { name?: string }).name !== "AbortError") setState("error");
      });
    return () => controller.abort();
  }, [debounced, current]);

  useEffect(() => onStateChange?.(state), [state, onStateChange]);

  const label = {
    idle: null,
    checking: t("username.checking"),
    available: t("username.available"),
    taken: t("username.taken"),
    invalid: t("username.invalid"),
    error: t("username.error"),
  }[state];

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-muted-foreground">@</span>
        <Input
          {...inputProps}
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={30}
          className={cn(
            "pl-7 pr-9",
            state === "available" && "border-success focus-visible:ring-success/30",
            (state === "taken" || state === "invalid") && "border-error focus-visible:ring-error/30",
          )}
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/\s/g, ""))}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2" aria-hidden>
          {state === "checking" ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
          {state === "available" ? <CheckCircle2 className="size-4 text-success" /> : null}
          {state === "taken" || state === "invalid" ? <XCircle className="size-4 text-error" /> : null}
        </span>
      </div>
      {label ? (
        <p
          role="status"
          className={cn(
            "text-[12px] font-medium",
            state === "available" && "text-success",
            (state === "taken" || state === "invalid") && "text-error",
            (state === "checking" || state === "error") && "text-muted-foreground",
          )}
        >
          {label}
        </p>
      ) : null}
    </div>
  );
}
