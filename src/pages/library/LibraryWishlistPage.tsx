import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { BookGrid } from "@/components/library/BookGrid";
import { useLibraryWishlist } from "@/hooks/library/useLibraryWishlist";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LibraryWishlistPage() {
  const { t } = useLanguage();
  const { books, isLoadingBooks, isInWishlist, toggleWishlist } = useLibraryWishlist();

  return (
    <Layout>
      <LibraryLayout title={t("library.nav.wishlist")} breadcrumb={[{ label: t("library.nav.wishlist") }]}>
        <BookGrid books={books} isLoading={isLoadingBooks} isOnShelf={isInWishlist} onToggleShelf={toggleWishlist} />
      </LibraryLayout>
    </Layout>
  );
}
