import { getServerDictionary } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

interface Measure {
  readonly dom: number;
  readonly requests: number;
  readonly sizeKb: number;
  readonly score: number;
  readonly grade: string;
  readonly gco2e: number;
  readonly waterCl: number;
}

export interface EcoReport {
  readonly measuredAt: string;
  readonly pages: readonly {
    readonly path: string;
    readonly label: string;
    readonly normal: Measure;
    readonly light: Measure;
    readonly slow3gLoadMs: number;
    /** The same page before this round of optimisation, when measured. */
    readonly before?: Pick<Measure, "sizeKb" | "requests" | "grade">;
  }[];
}

const GRADE_TONE: Record<string, string> = {
  A: "bg-[#2e7d32] text-white",
  B: "bg-[#558b2f] text-white",
  C: "bg-[#9e9d24] text-white",
  D: "bg-[#f9a825] text-black",
  E: "bg-[#ef6c00] text-white",
  F: "bg-[#d84315] text-white",
  G: "bg-[#b71c1c] text-white",
};

function Grade({ grade }: { readonly grade: string }) {
  return <span className={cn("inline-grid size-7 place-items-center rounded-md text-[0.8125rem] font-bold", GRADE_TONE[grade] ?? "bg-muted")}>{grade}</span>;
}

function weight(kb: number): string {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} Mo` : `${kb} Ko`;
}

/** One row per journey: as served, in light mode, and the slow-3G load time. */
export async function EcoReportTable({ report }: { readonly report: EcoReport }) {
  const { t } = await getServerDictionary();
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[600px] border-collapse text-[0.8438rem]">
        <caption className="sr-only">{t("tn.eco.measure.title")}</caption>
        <thead>
          <tr className="border-b border-border text-left text-[0.75rem] uppercase tracking-wide text-muted-foreground">
            <th scope="col" className="px-1 py-2 font-medium">{t("tn.eco.table.page")}</th>
            <th scope="col" className="px-1 py-2 font-medium">{t("tn.eco.table.before")}</th>
            <th scope="col" className="px-1 py-2 font-medium">{t("tn.eco.table.normal")}</th>
            <th scope="col" className="px-1 py-2 font-medium">{t("tn.eco.table.light")}</th>
            <th scope="col" className="px-1 py-2 font-medium">{t("tn.eco.table.slow")}</th>
            <th scope="col" className="px-1 py-2 font-medium">{t("tn.eco.table.co2")}</th>
          </tr>
        </thead>
        <tbody>
          {report.pages.map((page) => (
            <tr key={page.path} className="border-b border-border/60 align-middle">
              <th scope="row" className="px-1 py-2.5 text-left font-medium">{page.label}</th>
              <td className="px-1 py-2.5 text-muted-foreground">
                {page.before ? (
                  <span className="flex items-center gap-2">
                    <Grade grade={page.before.grade} />
                    {weight(page.before.sizeKb)}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-1 py-2.5">
                <span className="flex items-center gap-2">
                  <Grade grade={page.normal.grade} />
                  <span>
                    {weight(page.normal.sizeKb)}
                    <span className="block text-[0.75rem] text-muted-foreground">{t("tn.eco.table.requests", { count: page.normal.requests })}</span>
                  </span>
                </span>
              </td>
              <td className="px-1 py-2.5">
                <span className="flex items-center gap-2">
                  <Grade grade={page.light.grade} />
                  <span>
                    {weight(page.light.sizeKb)}
                    <span className="block text-[0.75rem] text-muted-foreground">{t("tn.eco.table.requests", { count: page.light.requests })}</span>
                  </span>
                </span>
              </td>
              <td className="px-1 py-2.5 tabular-nums">{(page.slow3gLoadMs / 1000).toFixed(1)} s</td>
              <td className="px-1 py-2.5 tabular-nums text-muted-foreground">
                {page.light.gco2e} g · {page.light.waterCl} cl
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
