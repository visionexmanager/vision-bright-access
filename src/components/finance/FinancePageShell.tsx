import { type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface FinancePageShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  /** Show skeleton placeholders while data loads */
  loading?: boolean;
  /** Number of skeleton cards to render */
  skeletonCount?: number;
}

export function FinancePageShell({
  title,
  description,
  actions,
  children,
  loading = false,
  skeletonCount = 4,
}: FinancePageShellProps) {
  return (
    <section aria-labelledby="fin-page-title">
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1
            id="fin-page-title"
            className="text-2xl font-bold tracking-tight"
          >
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 items-center gap-2 mt-2 sm:mt-0">
            {actions}
          </div>
        )}
      </div>

      {/* Content or skeleton */}
      {loading ? (
        <div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          aria-busy="true"
          aria-label="Loading content"
        >
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        children ?? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-20 text-center gap-3">
            <div className="text-4xl">📊</div>
            <p className="font-semibold text-base">Coming Soon</p>
            <p className="text-muted-foreground text-sm max-w-xs">
              This section is under development. Check back soon for live market data and tools.
            </p>
          </div>
        )
      )}
    </section>
  );
}
