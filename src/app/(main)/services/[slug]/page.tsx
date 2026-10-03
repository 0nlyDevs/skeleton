import { Clock, Mail, MapPin, Phone, Send } from "lucide-react";
import type { Metadata } from "next";

import { AnnouncementCard } from "@/components/city/announcement-card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { NotFoundPanel } from "@/components/feedback/not-found-panel";
import { ServiceIcon } from "@/components/city/service-icon";
import { MarkServiceSeen } from "@/components/city/welcome-guide";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { getAuthContext } from "@/lib/auth/session";
import { NotFoundError } from "@/lib/errors";
import { getServerDictionary } from "@/lib/i18n/server";
import { listAnnouncements } from "@/modules/announcements/announcements.service";
import { getService } from "@/modules/city-services/city-services.service";
import { serviceSlugParamSchema } from "@/modules/city-services/city-services.schema";

export const metadata: Metadata = { title: "Service municipal" };

/** D05 — one service: what it does, how to proceed, how to reach it. */
export default async function ServicePage({ params }: { readonly params: Promise<{ slug: string }> }) {
  const parsed = serviceSlugParamSchema.safeParse(await params);
  const { t } = await getServerDictionary();
  const context = await getAuthContext();
  const viewer = context?.user ?? null;

  const service = parsed.success
    ? await getService(parsed.data.slug, viewer).catch((error: unknown) => {
        if (error instanceof NotFoundError) return null;
        throw error;
      })
    : null;
  if (!service) return <NotFoundPanel backHref="/services" />;

  const news = await listAnnouncements({ service: service.slug, page: 1, limit: 3 }, viewer);
  const contact = [
    { icon: Clock, label: t("tn.services.hours"), value: service.hours },
    { icon: MapPin, label: t("tn.services.address"), value: service.address },
    { icon: Phone, label: t("tn.services.phone"), value: service.phone, href: service.phone ? `tel:${service.phone.replace(/\s+/g, "")}` : null },
    { icon: Mail, label: t("tn.services.email"), value: service.email, href: service.email ? `mailto:${service.email}` : null },
  ].filter((item) => item.value);

  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-5">
      {viewer ? <MarkServiceSeen /> : null}
      <Breadcrumbs
        label={t("tn.breadcrumb.label")}
        items={[{ label: t("tn.nav.home"), href: "/" }, { label: t("tn.nav.services"), href: "/services" }, { label: service.name }]}
      />

      <header className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-panel sm:flex-row sm:items-start">
        <ServiceIcon name={service.icon} className="size-14 rounded-2xl" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{service.category}</Badge>
            {!service.active ? <Badge variant="warning">{t("tn.services.inactive")}</Badge> : null}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{service.name}</h1>
          <p className="text-[0.9375rem] text-muted-foreground">{service.summary}</p>
        </div>
        <Button asChild className="shrink-0">
          <Link href={`/contact?service=${encodeURIComponent(service.slug)}`}>
            <Send aria-hidden />
            {t("tn.services.ask")}
          </Link>
        </Button>
      </header>

      <div className="grid gap-5 md:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-5">
          <section className="rounded-2xl border border-border/70 bg-card p-5">
            <p className="prose-body text-[0.9375rem]">{service.description}</p>
          </section>
          {service.howTo ? (
            <section className="rounded-2xl border border-border/70 bg-card p-5" aria-labelledby="how-to">
              <h2 id="how-to" className="mb-2 font-semibold">{t("tn.services.how_to")}</h2>
              <p className="prose-body text-[0.9375rem]">{service.howTo}</p>
            </section>
          ) : null}
          {news.data.length > 0 ? (
            <section className="flex flex-col gap-3" aria-labelledby="related-news">
              <h2 id="related-news" className="px-1 font-semibold">{t("tn.services.related_news")}</h2>
              {news.data.map((announcement) => (
                <AnnouncementCard key={announcement.id} announcement={announcement} compact />
              ))}
            </section>
          ) : null}
        </div>

        {contact.length > 0 ? (
          <aside className="h-fit rounded-2xl border border-border/70 bg-card p-5" aria-labelledby="contact">
            <h2 id="contact" className="mb-3 font-semibold">{t("tn.services.contact")}</h2>
            <dl className="flex flex-col gap-3 text-sm">
              {contact.map((item) => (
                <div key={item.label} className="flex gap-2.5">
                  <item.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <dt className="text-[0.75rem] text-muted-foreground">{item.label}</dt>
                    <dd className="break-words">
                      {item.href ? <a href={item.href} className="text-primary hover:underline">{item.value}</a> : item.value}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
