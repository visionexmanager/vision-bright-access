import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface AcademySectionHeaderProps {
  icon: LucideIcon;
  iconClassName?: string;
  title: string;
  description?: string;
  /** Optional trailing element (e.g. a "See all" link/button, a badge). */
  action?: ReactNode;
  /** id used by <section aria-labelledby> in the parent — keeps landmarks announced correctly by screen readers. */
  headingId: string;
}

export function AcademySectionHeader({
  icon: Icon,
  iconClassName = "bg-primary/10 text-primary",
  title,
  description,
  action,
  headingId,
}: AcademySectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-2xl shrink-0 ${iconClassName}`} aria-hidden="true">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h2 id={headingId} className="text-xl font-black text-foreground tracking-tight">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
