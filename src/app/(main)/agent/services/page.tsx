import { Plus } from "lucide-react";
import type { Metadata } from "next";

import { withAgentAccess } from "@/components/agent/agent-guard";
import { ServiceIcon } from "@/components/city/service-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { getServerDictionary } from "@/lib/i18n/server";
import { listServices } from "@/modules/city-services/city-services.service";

export const metadata: Metadata = { title: "Services — administration" };

/** Admin only: the list of services, closed ones included. */
export default async function AgentServicesPage() {
  return withAgentAccess(
    "/agent/services",
    async (user) => {
      const { t } = await getServerDictionary();
      const services = await listServices({ includeInactive: true }, user);
      return (
        <div className="flex flex-col gap-4">
          <header className="flex flex-wrap items-end justify-between gap-3 px-1">
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-semibold tracking-tight">{t("tn.agent.services.title")}</h1>
              <p className="text-sm text-muted-foreground">{t("tn.agent.services.subtitle")}</p>
            </div>
            <Button asChild>
              <Link href="/agent/services/new">
                <Plus aria-hidden />
                {t("tn.agent.services.new")}
              </Link>
            </Button>
          </header>
          <ul className="grid gap-3 sm:grid-cols-2">
            {services.map((service) => (
              <li key={service.id}>
                <Link href={`/agent/services/${service.slug}`} className="flex gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-panel hover:border-primary/40">
                  <ServiceIcon name={service.icon} />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-1.5 font-semibold">
                      {service.name}
                      {!service.active ? <Badge variant="warning">{t("tn.services.inactive")}</Badge> : null}
                    </span>
                    <span className="text-[12.5px] text-muted-foreground">{service.category}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      );
    },
    "admin",
  );
}
