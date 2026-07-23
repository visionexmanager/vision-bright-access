import { Link } from "react-router-dom";
import { BookOpenCheck } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { ReadingProgress } from "@/components/library/ReadingProgress";
import { EmptyState } from "@/components/library/EmptyState";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { Card } from "@/components/ui/card";
import { useContinueReading } from "@/hooks/library/useContinueReading";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LibraryContinueReading() {
  const { t } = useLanguage();
  const { items, isLoading } = useContinueReading();

  return (
    <Layout>
      <LibraryLayout title={t("library.nav.continueReading")} breadcrumb={[{ label: t("library.nav.continueReading") }]}>
        {isLoading ? (
          <SkeletonLoader variant="list" />
        ) : items.length === 0 ? (
          <EmptyState icon={<BookOpenCheck className="h-10 w-10" />} title={t("library.emptyState.noContinueReadingTitle")} description={t("library.emptyState.noContinueReadingDesc")} actionLabel={t("library.nav.categories")} actionTo="/library/categories" />
        ) : (
          <div className="space-y-3" role="list">
            {items.map(({ book, percent_complete }) => (
              <Link key={book.id} to={`/library/read/${book.id}`} role="listitem" className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
                <Card className="flex items-center gap-4 p-4 hover:shadow-md">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold">{book.title}</h3>
                    <p className="truncate text-xs text-muted-foreground">{book.author_name}</p>
                    <ReadingProgress percentComplete={percent_complete} className="mt-2 max-w-xs" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
