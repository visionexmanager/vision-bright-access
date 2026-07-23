import { Skeleton } from "@/components/ui/skeleton";

interface SkeletonLoaderProps {
  variant?: "grid" | "list" | "detail";
  count?: number;
}

export function SkeletonLoader({ variant = "grid", count = 8 }: SkeletonLoaderProps) {
  if (variant === "detail") {
    return (
      <div className="space-y-4" aria-hidden="true">
        <Skeleton className="h-64 w-48 rounded-xl" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className="space-y-3" aria-hidden="true">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-16 w-12 shrink-0 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-[2/3] w-full rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
