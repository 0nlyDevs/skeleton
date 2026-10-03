import type { Metadata } from "next";

import { AlertComposer } from "@/components/alerts/alert-composer";
import { withAgentAccess } from "@/components/agent/agent-guard";

export const metadata: Metadata = { title: "Nouvelle alerte" };

export default async function NewCityAlertPage() {
  return withAgentAccess("/agent/alerts/new", () => <AlertComposer />);
}
