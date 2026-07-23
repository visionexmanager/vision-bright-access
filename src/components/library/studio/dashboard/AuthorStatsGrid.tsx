import { BookOpen, CheckCircle2, FileEdit, Clock, Eye, Download, Users, DollarSign, Star, MessageSquare } from "lucide-react";
import { StatTile } from "@/components/library/StatTile";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { useLanguage } from "@/contexts/LanguageContext";
import type { AuthorDashboardStats } from "@/lib/types/library-studio";

interface AuthorStatsGridProps {
  stats: AuthorDashboardStats | null;
  isLoading?: boolean;
}

export function AuthorStatsGrid({ stats, isLoading }: AuthorStatsGridProps) {
  const { t } = useLanguage();

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-hidden="true">
        {Array.from({ length: 10 }).map((_, i) => (
          <SkeletonLoader key={i} variant="grid" count={1} />
        ))}
      </div>
    );
  }

  const tiles = [
    { icon: BookOpen, value: stats.totalBooks, label: t("library.studio.dashboard.totalBooks") },
    { icon: CheckCircle2, value: stats.publishedBooks, label: t("library.studio.dashboard.publishedBooks") },
    { icon: FileEdit, value: stats.drafts, label: t("library.studio.dashboard.drafts") },
    { icon: Clock, value: stats.pendingReview, label: t("library.studio.dashboard.pendingReview") },
    { icon: Eye, value: stats.totalReads, label: t("library.studio.dashboard.totalReads") },
    { icon: Download, value: stats.totalDownloads, label: t("library.studio.dashboard.downloads") },
    { icon: Users, value: stats.followers, label: t("library.studio.dashboard.followers") },
    { icon: DollarSign, value: Math.round(stats.revenueUsd), label: t("library.studio.dashboard.revenue") },
    { icon: Star, value: Math.round((stats.ratingAvg ?? 0) * 10) / 10, label: t("library.studio.dashboard.rating") },
    { icon: MessageSquare, value: stats.totalReviews, label: t("library.studio.dashboard.reviews") },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" role="list" aria-label={t("library.studio.dashboard.title")}>
      {tiles.map((tile) => (
        <div role="listitem" key={tile.label}>
          <StatTile {...tile} />
        </div>
      ))}
    </div>
  );
}
