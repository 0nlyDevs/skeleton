import type { ReactNode } from "react";

/**
 * The assistant answers with light formatting marks (**bold**, "- " lists,
 * "#" titles). They are shown as real emphasis and lists, built as React
 * nodes: the answer is never injected as HTML.
 */

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) return <span key={index} className="font-semibold">{part.slice(1, -1)}</span>;
    return part.replace(/(^|\s)\*([^*\s][^*]*)\*(?=\s|[.,;:!?]|$)/g, "$1$2");
  });
}

export function ReplyText({ text }: { readonly text: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = (): void => {
    if (!list) return;
    const items = list.items.map((item, index) => <li key={index}>{inline(item)}</li>);
    blocks.push(
      list.ordered ? (
        <ol key={blocks.length} className="list-decimal space-y-1 pl-5">{items}</ol>
      ) : (
        <ul key={blocks.length} className="list-disc space-y-1 pl-5">{items}</ul>
      ),
    );
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    const item = bullet ?? numbered;
    if (item) {
      const ordered = numbered !== null && bullet === null;
      if (list && list.ordered !== ordered) flush();
      list ??= { ordered, items: [] };
      list.items.push(item[1] ?? "");
      continue;
    }
    flush();
    if (!line) continue;
    const title = /^#{1,6}\s+(.*)$/.exec(line);
    blocks.push(
      title ? (
        <p key={blocks.length} className="font-semibold">{inline(title[1] ?? "")}</p>
      ) : (
        <p key={blocks.length}>{inline(line)}</p>
      ),
    );
  }
  flush();
  return <div className="space-y-2">{blocks}</div>;
}
