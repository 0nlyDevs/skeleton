import type { ReactNode } from "react";

import { ForbiddenPanel } from "@/components/feedback/forbidden-panel";
import { ADMIN_ROLES, STAFF_ROLES } from "@/lib/auth/roles";
import { requirePageRole } from "@/lib/auth/page-guards";
import { getServerDictionary } from "@/lib/i18n/server";
import type { AuthUser } from "@/types";

/**
 * D09 — every agent page starts here. A citizen gets a 403 panel, a guest is
 * sent to sign in; the API behind each page enforces the same roles.
 */
export async function withAgentAccess(
  path: string,
  render: (user: AuthUser) => Promise<ReactNode> | ReactNode,
  level: "staff" | "admin" = "staff",
): Promise<ReactNode> {
  const { context, allowed } = await requirePageRole(path, level === "admin" ? ADMIN_ROLES : STAFF_ROLES);
  if (allowed) return render(context.user);
  const { t } = await getServerDictionary();
  const staff = STAFF_ROLES.includes(context.user.role);
  return (
    <ForbiddenPanel
      title={level === "admin" && staff ? t("tn.agent.admin_only_title") : t("tn.agent.forbidden_title")}
      body={level === "admin" && staff ? t("tn.agent.admin_only_body") : t("tn.agent.forbidden_body")}
      backHref={staff ? "/agent" : "/space"}
      backLabel={staff ? t("tn.agent.title") : t("tn.nav.my_space")}
    />
  );
}
