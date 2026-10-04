import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading boundary for the main app.
 *
 * Fires on every navigation inside `(main)/`: while the layout's async data
 * (session, zone, onboarding flags) and the target page's data resolve, this
 * skeleton keeps the shell in place and shows a shimmer where the content will
 * land. Users perceive instant feedback instead of a blank flash.
 */
export default function MainLoading() {
  return (
    <div className="space-y-5">
      {/* Place sub-navigation (visible on mobile only). */}
      <div className="lg:hidden">
        <Skeleton className="h-[2.75rem] w-full max-w-xs" />
      </div>

      {/* Page heading. */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Content area — a few lines of placeholder. */}
      <div className="space-y-3 pt-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
      </div>

      {/* A card or list item placeholder. */}
      <div className="space-y-2 pt-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}
