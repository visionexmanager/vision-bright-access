import { useParams } from "react-router-dom";
import { Building2, Users2, UserPlus, UserCheck, Globe } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { BookGrid } from "@/components/library/BookGrid";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { Button } from "@/components/ui/button";
import { usePublisherProfile } from "@/hooks/library/usePublisherProfile";
import { useBookCatalog } from "@/hooks/library/useBookCatalog";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Publisher Store — mirrors LibraryAuthorProfile.tsx's shape exactly
 * (photo/bio/follow/follower-count/books-grid). library_publishers has no
 * user_id/owner account (admin-curated catalog entities, unlike self-service
 * library_authors) — read-only + follow, no publisher-side dashboard, and
 * revenue data is never surfaced here (same privacy boundary as authors).
 */
export default function LibraryPublisherProfile() {
  const { t } = useLanguage();
  const { slug } = useParams<{ slug: string }>();
  const { publisher, isLoading, isFollowing, canFollow, toggleFollow } = usePublisherProfile(slug);
  const { books, isLoading: booksLoading } = useBookCatalog(publisher ? { publisherId: publisher.id } : {});

  return (
    <Layout>
      <LibraryLayout
        title={publisher?.name ?? t("library.nav.publishers")}
        breadcrumb={publisher ? [{ label: publisher.name }] : []}
      >
        {isLoading ? (
          <SkeletonLoader variant="detail" />
        ) : !publisher ? (
          <EmptyState icon={<Users2 className="h-10 w-10" />} title={t("library.emptyState.publisherNotFoundTitle")} actionLabel={t("library.nav.home")} actionTo="/library" />
        ) : (
          <div className="space-y-8">
            {publisher.banner_url && (
              <div className="h-32 w-full overflow-hidden rounded-xl bg-muted sm:h-48">
                <img src={publisher.banner_url} alt="" className="h-full w-full object-cover" />
              </div>
            )}
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-start">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground/50" aria-hidden="true">
                {publisher.logo_url ? <img src={publisher.logo_url} alt="" className="h-full w-full object-cover" /> : <Building2 className="h-10 w-10" />}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                  <h2 className="text-2xl font-bold">{publisher.name}</h2>
                  {canFollow && (
                    <Button size="sm" variant={isFollowing ? "outline" : "default"} className="gap-1.5" onClick={() => void toggleFollow()}>
                      {isFollowing ? <UserCheck className="h-4 w-4" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}
                      {isFollowing ? t("library.authors.following") : t("library.authors.follow")}
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{t("library.authors.followerCount").replace("{count}", String(publisher.follower_count))}</p>
                {publisher.website_url && (
                  <a href={publisher.website_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                    <Globe className="h-3.5 w-3.5" aria-hidden="true" /> {publisher.website_url}
                  </a>
                )}
                {(publisher.bio || publisher.description) && (
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{publisher.bio || publisher.description}</p>
                )}
              </div>
            </div>
            <section>
              <h2 className="mb-4 text-lg font-semibold">{t("library.publishers.booksBy").replace("{name}", publisher.name)}</h2>
              <BookGrid books={books} isLoading={booksLoading} />
            </section>
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
