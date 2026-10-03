import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getCurrentUser } from "@/lib/auth/session";

/**
 * Layout for the authentication route group.
 *
 * A signed-in visitor is sent to their feed — arriving at `/login` with a live
 * session is always a mistake, and bouncing them is kinder than showing a form.
 * The layout provides a full-bleed container for the futuristic auth interface.
 */
export default async function AuthLayout({ children }: { readonly children: ReactNode }) {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect("/feed");

  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-[#faf9f5] dark:bg-[#02040b]">
      {children}
    </div>
  );
}
