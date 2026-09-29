import { getStack } from "@/lib/stack";
import type { Dictionary } from "@/lib/i18n";

/**
 * Stack section.
 *
 * Every version here is read from `package.json` at render time, so the page
 * cannot claim a library the project no longer uses. A two-column definition list
 * keeps it scannable without turning into a wall of badges.
 */
export function StackSection({ t }: { readonly t: Dictionary }) {
  const stack = getStack();

  return (
    <section id="stack" className="scroll-mt-20 border-b border-border/70 bg-surface/40">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 lg:px-8 lg:py-24">
        <header className="flex max-w-2xl flex-col gap-3">
          <h2 className="text-[28px] font-semibold tracking-[-0.015em] sm:text-[34px]">
            {t["landing.stack.title"]}
          </h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            {t["landing.stack.hint"]}
          </p>
        </header>

        <dl className="mt-12 grid grid-cols-1 gap-x-10 gap-y-px sm:grid-cols-2">
          {stack.map((entry) => (
            <div
              key={entry.name}
              className="flex items-baseline justify-between gap-4 border-b border-border/70 py-3.5"
            >
              <dt className="flex min-w-0 flex-col">
                <span className="truncate font-mono text-[13px] font-medium">{entry.name}</span>
                <span className="truncate text-[12.5px] text-muted-foreground">{entry.role}</span>
              </dt>
              <dd className="shrink-0 font-mono text-[12.5px] tabular-nums text-muted-foreground">
                {entry.version}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
