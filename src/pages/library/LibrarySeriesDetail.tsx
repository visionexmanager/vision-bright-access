import { useParams } from "react-router-dom";
import { Library } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { BookGrid } from "@/components/library/BookGrid";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { useSeriesBySlug } from "@/hooks/library/useSeries";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LibrarySeriesDetail() {
  const { t } = useLanguage();
  const { slug } = useParams<{ slug: string }>();
  const { series, books, isLoading } = useSeriesBySlug(slug);

  const orderedBooks = books.slice().sort((a, b) => (a.seriesPosition ?? 0) - (b.seriesPosition ?? 0));

  return (
    <Layout>
      <LibraryLayout title={series?.title ?? t("library.nav.home")} breadcrumb={series ? [{ label: series.title }] : []}>
        {isLoading ? (
          <SkeletonLoader variant="detail" />
        ) : !series ? (
          <EmptyState icon={<Library className="h-10 w-10" />} title={t("library.emptyState.seriesNotFoundTitle")} actionLabel={t("library.nav.home")} actionTo="/library" />
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6">
              {series.cover_image_url && (
                <img src={series.cover_image_url} alt="" className="mb-4 h-32 w-full rounded-xl object-cover sm:h-48" />
              )}
              <h2 className="text-2xl font-bold">{series.title}</h2>
              {series.description && <p className="mt-2 max-w-2xl text-muted-foreground">{series.description}</p>}
            </div>
            <BookGrid books={orderedBooks} />
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
