"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { apiFetch } from "@/lib/api/client";

/**
 * F81 — the client half of the robot protection: asks for the form's token
 * when the form opens and carries the hidden trap field. People never see
 * either; the server refuses a form without them.
 */
export function useFormGuard(): { guard: () => { token: string | null; trap: string }; renew: () => void; trapField: ReactNode } {
  const token = useRef<string | null>(null);
  const [trap, setTrap] = useState("");

  const renew = useCallback(() => {
    void apiFetch<{ data: { token: string } }>("/api/form-token")
      .then((response) => {
        token.current = response.data.token;
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => renew(), [renew]);

  return {
    guard: () => ({ token: token.current, trap }),
    renew,
    trapField: (
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={trap} onChange={(event) => setTrap(event.target.value)} />
        </label>
      </div>
    ),
  };
}
