import { AlertTriangle } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { LegalDocument, LegalSection } from "@/content/legal";
import type { Translator } from "@/lib/i18n";

/**
 * Renders a legal document.
 *
 * `**bold**` spans are supported because a sub-processor that receives message
 * content should not read the same as one that receives an email address — the
 * emphasis is the point, not decoration. Bold is applied by splitting on the
 * marker rather than with `dangerouslySetInnerHTML`, so no document copy can
 * inject markup.
 */
function RichText({ text }: { readonly text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <strong key={index} className="font-semibold text-foreground">
            {part}
          </strong>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

function Section({ section, t }: { readonly section: LegalSection; readonly t: Translator }) {
  return (
    <section id={section.id} className="scroll-mt-24">
      <h2 className="flex flex-wrap items-center gap-2 text-[17px] font-semibold tracking-tight">
        {section.title}
        {section.subject ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-warning/40 bg-warning/10 px-1.5 py-0.5 align-middle text-[10.5px] font-semibold uppercase tracking-wide text-warning-foreground">
            <AlertTriangle className="size-3" aria-hidden />
            {t("legal.incomplete")}
          </span>
        ) : null}
      </h2>

      <div className="mt-2.5 space-y-3 text-[14.5px] leading-relaxed text-muted-foreground">
        {section.paragraphs.map((paragraph, index) => (
          <p key={index}>
            <RichText text={paragraph} />
          </p>
        ))}

        {section.bullets ? (
          <ul className="list-disc space-y-1.5 pl-5 marker:text-muted-foreground/60">
            {section.bullets.map((bullet, index) => (
              <li key={index}>
                <RichText text={bullet} />
              </li>
            ))}
          </ul>
        ) : null}

        {section.rows ? (
          <div className="overflow-x-auto rounded-xl border border-border/70">
            <table className="w-full border-collapse text-left text-[14px]">
              <tbody>
                {section.rows.map(([term, detail], index) => (
                  <tr
                    key={term}
                    className={index % 2 === 1 ? "bg-surface-muted/40" : undefined}
                  >
                    <th
                      scope="row"
                      className="w-[38%] min-w-[160px] border-b border-border/60 px-4 py-3 align-top font-semibold text-foreground"
                    >
                      {term}
                    </th>
                    <td className="border-b border-border/60 px-4 py-3 align-top leading-relaxed">
                      <RichText text={detail} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function LegalPage({ document, t }: { readonly document: LegalDocument; readonly t: Translator }) {
  const title = document.slug === "privacy" ? t("legal.privacy.title") : t("legal.terms.title");

  return (
    <div className="mx-auto w-full max-w-[760px] py-2">
      <header className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          {t("legal.updated", { date: document.updated })}
        </p>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
          <RichText text={document.intro} />
        </p>
      </header>

      <nav aria-label={t("legal.toc")} className="mb-8">
        <Card className="p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("legal.toc")}
          </p>
          <ol className="flex flex-col gap-1">
            {document.sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-[13.5px] text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </Card>
      </nav>

      <div className="flex flex-col gap-9">
        {document.sections.map((section) => (
          <Section key={section.id} section={section} t={t} />
        ))}
      </div>
    </div>
  );
}
