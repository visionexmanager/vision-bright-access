import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { AuthorCard } from "@/components/library/AuthorCard";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { Users2 } from "lucide-react";
import { useAuthors } from "@/hooks/library/useAuthors";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LibraryAuthors() {
  const { t } = useLanguage();
  const { authors, isLoading } = useAuthors();

  return (
    <Layout>
      <LibraryLayout title={t("library.nav.authors")} breadcrumb={[{ label: t("library.nav.authors") }]}>
        {isLoading ? (
          <SkeletonLoader variant="grid" count={6} />
        ) : authors.length === 0 ? (
          <EmptyState icon={<Users2 className="h-10 w-10" />} title={t("library.emptyState.noAuthorsTitle")} />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4" role="list">
            {authors.map((author) => (
              <div role="listitem" key={author.id}>
                <AuthorCard author={author} />
              </div>
            ))}
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
