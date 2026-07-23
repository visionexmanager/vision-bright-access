import { useParams } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { BookGrid } from "@/components/library/BookGrid";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { useCollectionDetail } from "@/hooks/library/useCollections";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LibraryCollectionDetail() {
  const { t } = useLanguage();
  const { slug } = useParams<{ slug: string }>();
  const { collection, books, isLoading } = useCollectionDetail(slug);

  return (
    <Layout>
      <LibraryLayout
        title={collection?.title ?? t("library.nav.home")}
        breadcrumb={collection ? [{ label: collection.title }] : []}
      >
        {isLoading ? (
          <SkeletonLoader variant="detail" />
        ) : !collection ? (
          <EmptyState icon={<Sparkles className="h-10 w-10" />} title={t("library.emptyState.collectionNotFoundTitle")} actionLabel={t("library.nav.home")} actionTo="/library" />
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6">
              {collection.cover_image_url && (
                <img src={collection.cover_image_url} alt="" className="mb-4 h-32 w-full rounded-xl object-cover sm:h-48" />
              )}
              <h2 className="text-2xl font-bold">{collection.title}</h2>
              {collection.description && <p className="mt-2 max-w-2xl text-muted-foreground">{collection.description}</p>}
            </div>
            <BookGrid books={books} />
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
