import { Link } from "react-router-dom";
import { Plus, BookOpen } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { Button } from "@/components/ui/button";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useBecomeAuthor } from "@/hooks/library/useBecomeAuthor";
import { useAuthorDashboard } from "@/hooks/library/useAuthorDashboard";
import { AuthorStatsGrid } from "@/components/library/studio/dashboard/AuthorStatsGrid";
import { MonthlyStatsChart } from "@/components/library/studio/dashboard/MonthlyStatsChart";
import { PendingReviewList } from "@/components/library/studio/dashboard/PendingReviewList";

export default function LibraryStudioDashboard() {
  const { t } = useLanguage();
  useDocumentHead({ title: t("library.studio.dashboard.title") });

  const { authorProfile, isLoading: isLoadingProfile } = useBecomeAuthor();
  const { stats, isLoadingStats, monthlyStats, books, isLoadingBooks, pendingReviewBooks } = useAuthorDashboard(authorProfile?.id);

  if (isLoadingProfile) {
    return (
      <Layout>
        <LibraryLayout title={t("library.studio.dashboard.title")}>
          <SkeletonLoader variant="detail" />
        </LibraryLayout>
      </Layout>
    );
  }

  if (!authorProfile) {
    return (
      <Layout>
        <LibraryLayout title={t("library.studio.dashboard.title")}>
          <EmptyState
            icon={<BookOpen className="h-10 w-10" />}
            title={t("library.studio.becomeAuthor.title")}
            description={t("library.studio.becomeAuthor.description")}
            actionLabel={t("library.studio.becomeAuthor.cta")}
            actionTo="/library/studio/become-author"
          />
        </LibraryLayout>
      </Layout>
    );
  }

  return (
    <Layout>
      <LibraryLayout title={t("library.studio.dashboard.title")}>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">{t("library.studio.dashboard.welcome").replace("{name}", authorProfile.name)}</h1>
            <Button asChild>
              <Link to="/library/studio/books/new">
                <Plus className="me-1.5 h-4 w-4" aria-hidden="true" />
                {t("library.studio.dashboard.newBook")}
              </Link>
            </Button>
          </div>

          <AuthorStatsGrid stats={stats} isLoading={isLoadingStats} />

          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <MonthlyStatsChart data={monthlyStats} />
            <PendingReviewList books={pendingReviewBooks} />
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold">{t("library.studio.dashboard.yourBooks")}</h2>
            {isLoadingBooks ? (
              <SkeletonLoader variant="grid" count={4} />
            ) : books.length === 0 ? (
              <EmptyState icon={<BookOpen className="h-10 w-10" />} title={t("library.studio.dashboard.noBooksYet")} actionLabel={t("library.studio.dashboard.newBook")} actionTo="/library/studio/books/new" />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {books.map((book) => (
                  <li key={book.id}>
                    <Link to={`/library/studio/books/${book.id}`} className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:bg-accent">
                      {book.cover_image_url ? (
                        <img src={book.cover_image_url} alt="" className="h-16 w-11 rounded object-cover" />
                      ) : (
                        <div className="flex h-16 w-11 items-center justify-center rounded bg-muted"><BookOpen className="h-5 w-5 text-muted-foreground" aria-hidden="true" /></div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{book.title}</p>
                        <p className="text-xs capitalize text-muted-foreground">{t(`library.studio.workflow.${book.publish_status}`)}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </LibraryLayout>
    </Layout>
  );
}
