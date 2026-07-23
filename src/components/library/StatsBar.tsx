import { BookOpen, Users, FileText, Star, Layers, Headphones } from "lucide-react";
import { StatTile } from "@/components/library/StatTile";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LibraryHomeStats } from "@/lib/types/library-home";

interface StatsBarProps {
  stats: LibraryHomeStats | null;
  isLoading?: boolean;
}

export function StatsBar({ stats, isLoading }: StatsBarProps) {
  const { t } = useLanguage();

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonLoader key={i} variant="grid" count={1} />
        ))}
      </div>
    );
  }

  const tiles = [
    { icon: BookOpen, value: stats.total_books, label: t("library.stats.books") },
    { icon: Users, value: stats.total_authors, label: t("library.stats.authors") },
    { icon: Star, value: stats.total_reviews, label: t("library.stats.reviews") },
    { icon: Layers, value: stats.total_categories, label: t("library.stats.categories") },
    { icon: Headphones, value: stats.total_audiobooks, label: t("library.stats.audiobooks") },
    { icon: FileText, value: stats.total_pages, label: t("library.stats.pages") },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" role="list" aria-label={t("library.stats.heading")}>
      {tiles.map((tile) => (
        <div role="listitem" key={tile.label}>
          <StatTile {...tile} />
        </div>
      ))}
    </div>
  );
}
