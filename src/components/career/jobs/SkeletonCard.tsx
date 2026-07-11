interface SkeletonCardProps {
  count?: number;
  className?: string;
}

export function SkeletonCard({ count = 1, className = "" }: SkeletonCardProps) {
  return (
    <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${className}`} role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-border/50 bg-card p-6">
          <div className="mb-4 h-12 w-12 rounded-xl bg-muted" />
          <div className="mb-2 h-4 w-3/4 rounded bg-muted" />
          <div className="mb-4 h-3 w-1/2 rounded bg-muted" />
          <div className="h-3 w-full rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
