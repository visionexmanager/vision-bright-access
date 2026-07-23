import { useMemo } from "react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { CategoryCard } from "@/components/library/CategoryCard";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { Sparkles } from "lucide-react";
import { useCategoriesWithStats } from "@/hooks/library/useCategoriesWithStats";
import { useAdmin } from "@/hooks/useAdmin";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";

export default function LibraryCategories() {
  const { t } = useLanguage();
  const { isAdmin } = useAdmin();
  const { categories, isLoading } = useCategoriesWithStats();

  const topLevel = useMemo(() => categories.filter((c) => !c.parent_id), [categories]);
  const subcategoryCountByParent = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of categories) {
      if (c.parent_id) counts.set(c.parent_id, (counts.get(c.parent_id) ?? 0) + 1);
    }
    return counts;
  }, [categories]);

  useDocumentHead({
    title: `${t("library.nav.categories")} — Visionex Library`,
    description: t("library.home.heroSubtitle"),
    canonicalPath: "/library/categories",
  });

  return (
    <Layout>
      <LibraryLayout title={t("library.nav.categories")} breadcrumb={[{ label: t("library.nav.categories") }]}>
        {isLoading ? (
          <SkeletonLoader variant="grid" count={8} />
        ) : topLevel.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="h-10 w-10" />}
            title={t("library.emptyState.noBooksTitle")}
            actionLabel={isAdmin ? t("library.home.addFirstBook") : undefined}
            actionTo={isAdmin ? "/library/admin" : undefined}
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4" role="list">
            {topLevel.map((category) => (
              <div role="listitem" key={category.id}>
                <CategoryCard category={category} subcategoryCount={subcategoryCountByParent.get(category.id)} />
              </div>
            ))}
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
