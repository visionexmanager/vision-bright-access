import { memo } from "react";
import { Link } from "react-router-dom";
import { Download, Eye, FileStack } from "lucide-react";
import { ResourceTypeBadge } from "./ResourceTypeBadge";
import { DifficultyBadge } from "@/components/academy/lms/DifficultyBadge";
import { StarRating } from "@/components/academy/lms/StarRating";
import type { AcademyLibraryResourceRow } from "@/lib/types/academy-modules";

interface ResourceCardProps {
  resource: AcademyLibraryResourceRow;
}

export const ResourceCard = memo(function ResourceCard({ resource }: ResourceCardProps) {
  return (
    <Link
      to={`/academy/library/${resource.id}`}
      className="group flex flex-col rounded-2xl border border-border bg-muted/30 overflow-hidden hover:border-primary hover:shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="h-28 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center" aria-hidden="true">
        <FileStack className="w-9 h-9 text-primary/40" />
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex flex-wrap gap-1.5">
          <ResourceTypeBadge type={resource.type} />
          <DifficultyBadge difficulty={resource.difficulty} />
        </div>
        <h3 className="font-bold text-foreground text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2">
          {resource.title}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-2">{resource.description}</p>

        <div className="mt-auto pt-2 flex items-center justify-between text-xs text-muted-foreground">
          <StarRating rating={resource.rating_avg} count={resource.rating_count} />
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" aria-hidden="true" />
            {resource.views_count.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50 mt-1 text-muted-foreground">
          <span>{resource.author ?? resource.category}</span>
          <span className="flex items-center gap-1">
            <Download className="w-3 h-3" aria-hidden="true" />
            {resource.downloads_count.toLocaleString()}
          </span>
        </div>
      </div>
    </Link>
  );
});
