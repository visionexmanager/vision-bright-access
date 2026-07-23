import { BookRail } from "@/components/library/BookRail";
import { useRecentlyViewed } from "@/hooks/library/useRecentlyViewed";
import { useMyShelf } from "@/hooks/library/useMyShelf";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

/** Signed-in only — renders nothing for anonymous visitors or once there's
 * simply no history yet (rather than an empty-state block competing for
 * attention on a page that already has its own primary empty state). */
export function RecentlyViewedRail() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { books, isLoading, error, refetch } = useRecentlyViewed();
  const { isOnShelf, toggleShelf } = useMyShelf();

  if (!user || (!isLoading && books.length === 0)) return null;

  return (
    <BookRail
      title={t("library.explorer.recentlyViewed")}
      books={books}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      isOnShelf={isOnShelf}
      onToggleShelf={toggleShelf}
      emptyTitle={t("library.explorer.recentlyViewed")}
    />
  );
}
