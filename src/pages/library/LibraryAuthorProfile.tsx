import { useParams } from "react-router-dom";
import { User, Users2, UserPlus, UserCheck } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { BookGrid } from "@/components/library/BookGrid";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { Button } from "@/components/ui/button";
import { useAuthorProfile } from "@/hooks/library/useAuthors";
import { useBookCatalog } from "@/hooks/library/useBookCatalog";
import { useAuthorFollow } from "@/hooks/library/useAuthorFollow";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LibraryAuthorProfile() {
  const { t } = useLanguage();
  const { authorId } = useParams<{ authorId: string }>();
  const { author, isLoading } = useAuthorProfile(authorId);
  const { books, isLoading: booksLoading } = useBookCatalog();
  const authorBooks = books.filter((b) => b.author_id === authorId);
  const { isFollowing, toggle: toggleFollow, canFollow } = useAuthorFollow(authorId);

  return (
    <Layout>
      <LibraryLayout title={author?.name ?? t("library.nav.authors")} breadcrumb={[{ label: t("library.nav.authors"), to: "/library/authors" }, ...(author ? [{ label: author.name }] : [])]}>
        {isLoading ? (
          <SkeletonLoader variant="detail" />
        ) : !author ? (
          <EmptyState icon={<Users2 className="h-10 w-10" />} title={t("library.emptyState.authorNotFoundTitle")} actionLabel={t("library.nav.authors")} actionTo="/library/authors" />
        ) : (
          <div className="space-y-8">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-start">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground/50" aria-hidden="true">
                {author.photo_url ? <img src={author.photo_url} alt="" className="h-full w-full object-cover" /> : <User className="h-10 w-10" />}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                  <h2 className="text-2xl font-bold">{author.name}</h2>
                  {canFollow && (
                    <Button size="sm" variant={isFollowing ? "outline" : "default"} className="gap-1.5" onClick={() => void toggleFollow()}>
                      {isFollowing ? <UserCheck className="h-4 w-4" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}
                      {isFollowing ? t("library.authors.following") : t("library.authors.follow")}
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{t("library.authors.followerCount").replace("{count}", String(author.follower_count))}</p>
                {author.nationality && <p className="text-sm text-muted-foreground">{author.nationality}</p>}
                {author.bio && <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{author.bio}</p>}
              </div>
            </div>
            <section>
              <h2 className="mb-4 text-lg font-semibold">{t("library.authors.booksBy").replace("{name}", author.name)}</h2>
              <BookGrid books={authorBooks} isLoading={booksLoading} />
            </section>
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
