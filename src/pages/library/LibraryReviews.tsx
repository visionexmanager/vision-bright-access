import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { EmptyState } from "@/components/library/EmptyState";
import { Loading } from "@/components/library/Loading";
import { queryKeys } from "@/lib/api/queryKeys";
import { fetchMyReviews } from "@/services/library/reviews";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LibraryReviews() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: queryKeys.library.reviews(user?.id ?? ""),
    enabled: !!user,
    queryFn: () => fetchMyReviews(user!.id),
  });

  return (
    <Layout>
      <LibraryLayout title={t("library.nav.reviews")} breadcrumb={[{ label: t("library.nav.reviews") }]}>
        {isLoading ? (
          <Loading />
        ) : reviews.length === 0 ? (
          <EmptyState icon={<Star className="h-10 w-10" />} title={t("library.emptyState.noReviewsTitle")} description={t("library.emptyState.noReviewsDesc")} actionLabel={t("library.nav.categories")} actionTo="/library/categories" />
        ) : null}
      </LibraryLayout>
    </Layout>
  );
}
