import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { BooksExplorerPanel } from "@/components/library/BooksExplorerPanel";
import { CategoryCard } from "@/components/library/CategoryCard";
import { RelatedCategories } from "@/components/library/RelatedCategories";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { Sparkles } from "lucide-react";
import { useCategoryDetails } from "@/hooks/library/useCategoryDetails";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { logLibraryAnalyticsEvent } from "@/services/library/analytics";

export default function LibraryCategoryDetails() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  const { category, subcategories, stats, relatedCategories, isLoading } = useCategoryDetails(slug);

  useEffect(() => {
    if (category) void logLibraryAnalyticsEvent("page_view", { userId: user?.id ?? null, entityType: "category", entityId: category.id });
  }, [category, user]);

  useDocumentHead({
    title: category ? `${category.name} — Visionex Library` : t("library.nav.categories"),
    description: category?.description ?? undefined,
    image: category?.image_url ?? undefined,
    canonicalPath: slug ? `/library/categories/${slug}` : undefined,
  });

  return (
    <Layout>
      <LibraryLayout
        title={category?.name ?? t("library.nav.categories")}
        breadcrumb={[{ label: t("library.nav.categories"), to: "/library/categories" }, ...(category ? [{ label: category.name }] : [])]}
      >
        {isLoading ? (
          <SkeletonLoader variant="detail" />
        ) : !category ? (
          <EmptyState icon={<Sparkles className="h-10 w-10" />} title={t("library.categoryDetails.notFoundTitle")} actionLabel={t("library.nav.categories")} actionTo="/library/categories" />
        ) : (
          <div className="space-y-8">
            <section className="overflow-hidden rounded-2xl border">
              {category.image_url && <img src={category.image_url} alt="" loading="lazy" className="h-40 w-full object-cover" />}
              <div className="p-6">
                <h2 className="text-2xl font-bold">{category.name}</h2>
                {category.description && <p className="mt-1 max-w-2xl text-muted-foreground">{category.description}</p>}
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                  <span>{category.book_count} {t("library.categories.books")}</span>
                  {stats && (
                    <>
                      <span>{stats.author_count} {t("library.categories.authors")}</span>
                      <span>{stats.total_views.toLocaleString()} {t("library.categoryDetails.reads")}</span>
                    </>
                  )}
                </div>
              </div>
            </section>

            {subcategories.length > 0 && (
              <section aria-labelledby="subcategories-heading">
                <h2 id="subcategories-heading" className="mb-4 text-lg font-semibold">{t("library.categoryDetails.subcategories")}</h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4" role="list">
                  {subcategories.map((sub) => (
                    <div role="listitem" key={sub.id}>
                      <CategoryCard category={sub} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section aria-labelledby="category-books-heading">
              <h2 id="category-books-heading" className="mb-4 text-lg font-semibold">{t("library.categories.books")}</h2>
              <BooksExplorerPanel fixedFilters={{ categoryId: category.id }} showPopularTags={false} />
            </section>

            <RelatedCategories categories={relatedCategories} />
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
