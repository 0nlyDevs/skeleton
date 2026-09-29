import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Skeletons shaped like the content they replace.
 *
 * A skeleton that does not match the final layout is worse than a spinner: the
 * page visibly reflows when the data lands. Each of these mirrors a real
 * composition elsewhere in the app.
 */
export function StatCardsSkeleton({ count = 4 }: { readonly count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-xl border border-border/70 bg-card p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-7 w-16" />
          <Skeleton className="mt-3 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { readonly rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="rounded-xl border border-border/70 bg-card p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-3 w-full max-w-lg" />
          <Skeleton className="mt-2 h-3 w-2/3 max-w-sm" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { readonly rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
      <div className="flex items-center gap-4 border-b border-border/70 px-4 py-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="ml-auto h-3 w-24" />
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-4 border-b border-border/60 px-4 py-3.5 last:border-b-0">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-3 w-36" />
          <Skeleton className="ml-auto h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function ChatSkeleton({ rows = 6 }: { readonly rows?: number }) {
  return (
    <div className="flex flex-col gap-3 p-4">
      {Array.from({ length: rows }, (_, index) => {
        const fromMe = index % 3 === 2;
        return (
          <div
            key={index}
            className={cn("flex items-end gap-2", fromMe ? "justify-end" : "justify-start")}
          >
            {!fromMe ? <Skeleton className="size-7 rounded-full" /> : null}
            <Skeleton className={cn("h-10 rounded-2xl", fromMe ? "w-48" : "w-64")} />
          </div>
        );
      })}
    </div>
  );
}
