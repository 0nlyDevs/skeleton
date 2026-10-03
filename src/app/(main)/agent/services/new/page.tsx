import type { Metadata } from "next";

import { withAgentAccess } from "@/components/agent/agent-guard";
import { ServiceEditor } from "@/components/agent/service-editor";

export const metadata: Metadata = { title: "Nouveau service" };

export default async function NewServicePage() {
  return withAgentAccess("/agent/services/new", () => <ServiceEditor initial={null} />, "admin");
}
