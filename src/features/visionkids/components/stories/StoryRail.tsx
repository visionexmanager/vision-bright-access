import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { StoryCard } from "@/features/visionkids/components/stories/StoryCard";
import type { Story } from "@/features/visionkids/types/stories.types";

interface StoryRailProps {
  title: string;
  stories: Story[];
  viewAllHref?: string;
  viewAllLabel?: string;
  emptyState?: ReactNode;
}

export function StoryRail({ title, stories, viewAllHref, viewAllLabel, emptyState }: StoryRailProps) {
  if (stories.length === 0 && !emptyState) return null;

  return (
    <section aria-label={title} className="px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <h2 className="font-heading text-xl font-bold sm:text-2xl">{title}</h2>
        {viewAllHref && stories.length > 0 && (
          <Link to={viewAllHref} className="flex items-center gap-1 text-sm font-semibold text-kids-primary hover:underline">
            {viewAllLabel} <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>

      {stories.length === 0 ? (
        <div className="mx-auto mt-3 max-w-6xl">{emptyState}</div>
      ) : (
        <div className="mx-auto mt-3 flex max-w-6xl gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "thin" }}>
          {stories.map((story) => (
            <div key={story.id} className="w-40 shrink-0 sm:w-48">
              <StoryCard story={story} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
