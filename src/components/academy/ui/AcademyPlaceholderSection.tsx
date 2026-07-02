import { memo } from "react";
import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AcademySectionHeader } from "./AcademySectionHeader";

interface AcademyPlaceholderSectionProps {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  description?: string;
  headingId: string;
  /** "cards" renders ghost course-card tiles, "chips" renders a row of pill-shaped ghost chips. */
  variant?: "cards" | "chips";
  itemCount?: number;
  /** Optional real, working link to an existing page (e.g. the platform's Community section). */
  linkHref?: string;
  linkLabel?: string;
}

/**
 * Generic "architecture ready, feature coming in a future phase" section.
 * Used for every Academy module that has planned types/services (see
 * src/lib/types/academy-modules.ts, src/lib/academy/moduleRegistry.ts) but no
 * UI/backend yet. Ghost cards double as the section's skeleton-loading look —
 * this is the section's permanent, honest empty state, not a transient spinner.
 */
export const AcademyPlaceholderSection = memo(function AcademyPlaceholderSection({
  icon,
  iconClassName,
  title,
  description,
  headingId,
  variant = "cards",
  itemCount = 3,
  linkHref,
  linkLabel,
}: AcademyPlaceholderSectionProps) {
  return (
    <section aria-labelledby={headingId} className="bg-card p-8 rounded-3xl border border-border shadow-lg">
      <AcademySectionHeader
        icon={icon}
        iconClassName={iconClassName}
        title={title}
        description={description}
        headingId={headingId}
        action={
          <Badge variant="secondary" className="gap-1">
            قريباً
          </Badge>
        }
      />

      {variant === "chips" ? (
        <div className="flex flex-wrap gap-2" aria-hidden="true">
          {Array.from({ length: itemCount }).map((_, i) => (
            <Skeleton key={i} className="h-9 rounded-xl" style={{ width: `${72 + (i % 3) * 24}px` }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-hidden="true">
          {Array.from({ length: itemCount }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-dashed border-border p-4 space-y-3">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      )}

      <p className="sr-only">
        {title} — هذا القسم قيد التطوير وسيتوفر في مرحلة قادمة.
      </p>

      {linkHref && (
        <div className="mt-6">
          <Button variant="outline" size="sm" asChild className="rounded-xl">
            <a href={linkHref}>{linkLabel ?? "استكشف الآن"}</a>
          </Button>
        </div>
      )}
    </section>
  );
});
