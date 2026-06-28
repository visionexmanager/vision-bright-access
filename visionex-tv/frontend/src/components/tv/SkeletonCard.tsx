export function SkeletonCard({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-28 h-20", md: "w-40 h-28", lg: "w-52 h-36" };
  return (
    <div className={`${sizes[size]} rounded-xl skeleton shrink-0`} />
  );
}

export function SkeletonRow({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonHero() {
  return (
    <div className="w-full h-64 md:h-96 rounded-2xl skeleton" />
  );
}
