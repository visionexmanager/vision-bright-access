import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { BookGrid } from "@/components/library/BookGrid";
import { useFavorites } from "@/hooks/library/useFavorites";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LibraryFavorites() {
  const { t } = useLanguage();
  const { books, isLoading, isFavorite, toggleFavorite } = useFavorites();

  return (
    <Layout>
      <LibraryLayout title={t("library.nav.favorites")} breadcrumb={[{ label: t("library.nav.favorites") }]}>
        <BookGrid books={books} isLoading={isLoading} isOnShelf={isFavorite} onToggleShelf={toggleFavorite} />
      </LibraryLayout>
    </Layout>
  );
}
