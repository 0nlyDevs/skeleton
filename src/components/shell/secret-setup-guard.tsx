"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * F71 — an account opened with an agent's printed access code is sent to the
 * security page until the resident chooses their own password or passkey: the
 * code was seen by someone else and must not stay the way in.
 */
export function SecretSetupGuard() {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (!pathname.startsWith("/settings/security")) router.replace("/settings/security?setup=1");
  }, [pathname, router]);
  return null;
}
