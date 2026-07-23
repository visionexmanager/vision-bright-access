import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { DownloadManagerRow } from "@/components/library/marketplace/DownloadManagerRow";
import { EmptyState } from "@/components/library/EmptyState";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { Download } from "lucide-react";
import { useDownloads } from "@/hooks/library/useDownloads";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LibraryDownloads() {
  const { t } = useLanguage();
  const { books, isLoading } = useDownloads();

  return (
    <Layout>
      <LibraryLayout title={t("library.nav.downloads")} breadcrumb={[{ label: t("library.nav.downloads") }]}>
        {isLoading ? (
          <SkeletonLoader variant="list" count={4} />
        ) : books.length === 0 ? (
          <EmptyState icon={<Download className="h-10 w-10" />} title={t("library.emptyState.noDownloadsTitle")} description={t("library.emptyState.noDownloadsDesc")} actionLabel={t("library.nav.categories")} actionTo="/library/categories" />
        ) : (
          <div className="space-y-3">
            {books.map((book) => (
              <DownloadManagerRow key={book.id} book={book} />
            ))}
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
