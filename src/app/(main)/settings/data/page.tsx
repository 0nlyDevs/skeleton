import { Download, FileText, FolderOpen, KeyRound, MessagesSquare, UserRound } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { PrintButton } from "@/components/city/print-button";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { requirePageAuth } from "@/lib/auth/page-guards";
import { formatDateTime, formatLongDate } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { getServerDictionary } from "@/lib/i18n/server";
import { buildDataReport } from "@/modules/account/account.report";

export const metadata: Metadata = { title: "Mes données" };

function Section({ icon, title, children, purpose, access, retention, labels }: {
  readonly labels: { readonly why: string; readonly who: string; readonly howLong: string };
  readonly icon: ReactNode;
  readonly title: string;
  readonly children: ReactNode;
  readonly purpose: string;
  readonly access: string;
  readonly retention: string;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-5 print:break-inside-avoid">
      <h2 className="flex items-center gap-2 font-semibold">
        {icon}
        {title}
      </h2>
      <div className="text-sm">{children}</div>
      <dl className="grid gap-2 rounded-xl bg-surface-muted/60 p-3 text-[0.8125rem] sm:grid-cols-3">
        <div>
          <dt className="font-medium">{labels.why}</dt>
          <dd className="text-muted-foreground">{purpose}</dd>
        </div>
        <div>
          <dt className="font-medium">{labels.who}</dt>
          <dd className="text-muted-foreground">{access}</dd>
        </div>
        <div>
          <dt className="font-medium">{labels.howLong}</dt>
          <dd className="text-muted-foreground">{retention}</dd>
        </div>
      </dl>
    </section>
  );
}

/**
 * F55 — "what does the city know about me?", answered in plain words: each
 * kind of data, with a few concrete details, what it is for, who sees it and
 * how long it is kept. Printable or saved as PDF; the full JSON file remains
 * one click away for re-use.
 */
export default async function MyDataPage() {
  const { user } = await requirePageAuth("/settings/data");
  const { t, locale } = await getServerDictionary();
  const report = await buildDataReport(user);
  const dash = "—";
  const date = (iso: string | null) => (iso ? formatLongDate(iso, locale) : dash);
  const labels = { why: t("tn.data.why"), who: t("tn.data.who"), howLong: t("tn.data.how_long") };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
        <PrintButton label={t("tn.data.print")} />
        <Button asChild variant="secondary">
          <a href="/api/users/me/export" download>
            <Download aria-hidden />
            {t("tn.data.json")}
          </a>
        </Button>
      </div>

      <article className="print-document flex flex-col gap-4">
        <header className="flex flex-col gap-1 px-1">
          <p className="text-[0.8125rem] font-medium text-primary">Terra Nova</p>
          <h1 className="text-2xl font-semibold tracking-tight">{t("tn.data.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("tn.data.subtitle", { name: report.identity.name, date: formatDateTime(report.generatedAt, locale) })}</p>
        </header>

        <Section
          labels={labels}
          icon={<UserRound className="size-4 text-primary" aria-hidden />}
          title={t("tn.data.identity.title")}
          purpose={t("tn.data.identity.purpose")}
          access={t("tn.data.identity.access")}
          retention={t("tn.data.identity.retention")}
        >
          <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            <div><dt className="text-muted-foreground">{t("tn.data.field.name")}</dt><dd>{report.identity.name}</dd></div>
            <div><dt className="text-muted-foreground">{t("tn.data.field.username")}</dt><dd>{report.identity.username ? `@${report.identity.username}` : dash}</dd></div>
            <div><dt className="text-muted-foreground">{t("tn.data.field.email")}</dt><dd>{report.identity.email ?? dash}{report.identity.emailVerified ? ` (${t("tn.data.field.verified")})` : ""}</dd></div>
            <div><dt className="text-muted-foreground">{t("tn.data.field.birth")}</dt><dd>{report.identity.birthDate ?? dash}</dd></div>
            <div><dt className="text-muted-foreground">{t("tn.data.field.role")}</dt><dd>{t(`role.${report.identity.role.toLowerCase()}` as MessageKey)}</dd></div>
            <div><dt className="text-muted-foreground">{t("tn.data.field.since")}</dt><dd>{date(report.identity.createdAt)}</dd></div>
            <div><dt className="text-muted-foreground">{t("tn.data.field.district")}</dt><dd>{report.identity.district ?? dash}</dd></div>
            <div><dt className="text-muted-foreground">{t("tn.data.field.profile")}</dt><dd>{[report.identity.hasPhoto ? t("tn.data.field.photo") : null, report.identity.hasBio ? t("tn.data.field.bio") : null].filter(Boolean).join(", ") || dash}</dd></div>
          </dl>
          <Link href="/settings/profile" className="mt-2 inline-block text-primary underline underline-offset-2 print:hidden">{t("tn.data.edit")}</Link>
        </Section>

        <Section
          labels={labels}
          icon={<FolderOpen className="size-4 text-primary" aria-hidden />}
          title={t("tn.data.requests.title")}
          purpose={t("tn.data.requests.purpose")}
          access={t("tn.data.requests.access")}
          retention={t("tn.data.requests.retention")}
        >
          <p>{t("tn.data.requests.count", { count: report.requests.count, open: report.requests.open })}</p>
          {report.requests.latest.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-1">
              {report.requests.latest.map((row) => (
                <li key={row.reference}>
                  <span className="font-mono text-[0.8125rem]">{row.reference}</span> · {row.subject} · {t(`tn.status.${row.status}` as MessageKey)} · {date(row.createdAt)}
                </li>
              ))}
            </ul>
          ) : null}
          <Link href="/space/summary" className="mt-2 inline-block text-primary underline underline-offset-2 print:hidden">{t("tn.summary.link")}</Link>
        </Section>

        <Section
          labels={labels}
          icon={<KeyRound className="size-4 text-primary" aria-hidden />}
          title={t("tn.data.security.title")}
          purpose={t("tn.data.security.purpose")}
          access={t("tn.data.security.access")}
          retention={t("tn.data.security.retention")}
        >
          <ul className="flex flex-col gap-1">
            <li>{t("tn.data.security.two_factor", { state: report.security.twoFactor ? t("tn.data.on") : t("tn.data.off") })}</li>
            <li>{t("tn.data.security.passkeys", { count: report.security.passkeys.length })}{report.security.passkeys.length > 0 ? ` : ${report.security.passkeys.map((key) => key.name ?? "Passkey").join(", ")}` : ""}</li>
            <li>{t("tn.data.security.devices", { count: report.security.devices.length })}{report.security.devices.length > 0 ? ` : ${report.security.devices.slice(0, 4).map((device) => `${device.label} (${date(device.lastSeenAt)})`).join(", ")}` : ""}</li>
            <li>{t("tn.data.security.sessions", { count: report.security.activeSessions })}</li>
          </ul>
          <Link href="/settings/security" className="mt-2 inline-block text-primary underline underline-offset-2 print:hidden">{t("tn.data.manage_security")}</Link>
        </Section>

        <Section
          labels={labels}
          icon={<MessagesSquare className="size-4 text-primary" aria-hidden />}
          title={t("tn.data.community.title")}
          purpose={t("tn.data.community.purpose")}
          access={t("tn.data.community.access")}
          retention={t("tn.data.community.retention")}
        >
          <p>
            {t("tn.data.community.summary", {
              posts: report.community.posts,
              comments: report.community.comments,
              messages: report.community.messagesSent,
              groups: report.community.groups,
              followers: report.community.followers,
              following: report.community.following,
            })}
          </p>
        </Section>

        <Section
          labels={labels}
          icon={<FileText className="size-4 text-primary" aria-hidden />}
          title={t("tn.data.notifications.title")}
          purpose={t("tn.data.notifications.purpose")}
          access={t("tn.data.notifications.access")}
          retention={t("tn.data.notifications.retention")}
        >
          <p>{t("tn.data.notifications.count", { count: report.notifications })}</p>
        </Section>

        <p className="px-1 text-[0.8125rem] text-muted-foreground">{t("tn.data.rights")}</p>
      </article>
    </div>
  );
}
