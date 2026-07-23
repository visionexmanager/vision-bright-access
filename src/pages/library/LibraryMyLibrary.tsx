import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { BookGrid } from "@/components/library/BookGrid";
import { useMyShelf } from "@/hooks/library/useMyShelf";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LibraryMyLibrary() {
  const { t } = useLanguage();
  const { books, isLoading, isOnShelf, toggleShelf } = useMyShelf();

  return (
    <Layout>
      <LibraryLayout title={t("library.nav.myLibrary")} breadcrumb={[{ label: t("library.nav.myLibrary") }]}>
        <BookGrid books={books} isLoading={isLoading} isOnShelf={isOnShelf} onToggleShelf={toggleShelf} />
      </LibraryLayout>
    </Layout>
  );
}
