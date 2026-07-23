import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { BookActions } from "@/components/library/BookActions";
import { BookDetailsHeader } from "@/components/library/BookDetailsHeader";
import { BookPreviewSection } from "@/components/library/BookPreviewSection";
import { ChaptersList } from "@/components/library/ChaptersList";
import { AuthorSection } from "@/components/library/AuthorSection";
import { BookQuotesSection } from "@/components/library/BookQuotesSection";
import { ReviewsList } from "@/components/library/ReviewsList";
import { BookDetailsAI } from "@/components/library/BookDetailsAI";
import { LearningHubBookActions } from "@/components/library/learning/LearningHubBookActions";
import { ReadingProgressCard } from "@/components/library/ReadingProgressCard";
import { AudiobookProgressCard } from "@/components/library/AudiobookProgressCard";
import { BookRail } from "@/components/library/BookRail";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { BookGallerySection } from "@/components/library/marketplace/BookGallerySection";
import { BookTrailerPlayer } from "@/components/library/marketplace/BookTrailerPlayer";
import { SeriesSection } from "@/components/library/marketplace/SeriesSection";
import { AwardsBadges } from "@/components/library/marketplace/AwardsBadges";
import { FrequentlyBoughtTogether } from "@/components/library/marketplace/FrequentlyBoughtTogether";
import { AccessibilityFeaturesPanel } from "@/components/library/marketplace/AccessibilityFeaturesPanel";
import { BookTranslationSwitcher } from "@/components/library/marketplace/BookTranslationSwitcher";
import { CitationDialog } from "@/components/library/marketplace/CitationDialog";
import { SearchInsideBookDialog } from "@/components/library/marketplace/SearchInsideBookDialog";
import { DiscussionBoard } from "@/components/library/community/DiscussionBoard";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";
import { useBookDetails } from "@/hooks/library/useBookDetails";
import { useRelatedBooks } from "@/hooks/library/useRelatedBooks";
import { useEntitiesForBook } from "@/hooks/library/useKnowledgeGraph";
import { KG_ENTITY_TYPE_COLORS } from "@/components/library/knowledgeGraph/entityTypeStyles";
import { useMyShelf } from "@/hooks/library/useMyShelf";
import { useFavorites } from "@/hooks/library/useFavorites";
import { useDownloads } from "@/hooks/library/useDownloads";
import { useBookAccess } from "@/hooks/library/useBookAccess";
import { useAudiobookProgress } from "@/hooks/library/useAudiobookProgress";
import { useChapters } from "@/hooks/library/useChapters";
import { useReadersAlsoRead } from "@/hooks/library/useReadersAlsoRead";
import { useLibraryCategories } from "@/hooks/library/useBookCatalog";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { recordRecentlyViewed } from "@/services/library/recentlyViewed";
import { fetchCatalog } from "@/services/library/catalog";

export default function LibraryBookDetails() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { bookId } = useParams<{ bookId: string }>();
  const { book, similar, isLoading } = useBookDetails(bookId);
  const { isOnShelf, toggleShelf } = useMyShelf();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { isDownloaded, toggleDownload } = useDownloads();
  const access = useBookAccess(book ? { id: book.id, is_free: book.is_free, author_id: book.author_id } : null);
  const { categories } = useLibraryCategories();
  const { progress, hasStarted: hasReadingProgress } = useAudiobookProgress(bookId);
  const { chapters } = useChapters(bookId, progress.current_page);
  const { books: readersAlsoRead } = useReadersAlsoRead(bookId);
  const { books: relatedBooks } = useRelatedBooks(bookId);
  const { entities: connectedEntities } = useEntitiesForBook(bookId);

  const { data: sameAuthorBooks = [] } = useQuery({
    queryKey: ["library", "same-author-books", book?.author_id, bookId],
    queryFn: () => fetchCatalog({ authorId: book!.author_id, sort: "rating", limit: 8 }),
    enabled: !!book,
  });

  const categoryName = book?.category_id ? categories.find((c) => c.id === book.category_id)?.name ?? null : null;

  // Recording a view here is also what feeds the book's daily view-count
  // stat (via the existing library_recently_viewed_bump_stat trigger) and
  // is the "book opens" analytics signal — see the Phase 4 plan.
  useEffect(() => {
    if (user && book) void recordRecentlyViewed(user.id, book.id);
  }, [user, book]);

  useDocumentHead({
    title: book ? `${book.title} — ${t("library.nav.home")}` : t("library.nav.bookDetails"),
    description: book?.description,
    image: book?.cover_image_url ?? undefined,
    canonicalPath: book ? `/library/books/${book.id}` : undefined,
    structuredData: book
      ? {
          "@context": "https://schema.org",
          "@type": "Book",
          name: book.title,
          author: { "@type": "Person", name: book.author_name },
          isbn: book.isbn ?? undefined,
          description: book.description,
          inLanguage: book.language,
          bookFormat: book.formats.includes("audiobook") ? "https://schema.org/AudiobookFormat" : "https://schema.org/EBook",
          ...(book.rating_count > 0
            ? { aggregateRating: { "@type": "AggregateRating", ratingValue: book.rating_avg ?? 0, ratingCount: book.rating_count } }
            : {}),
        }
      : undefined,
  });

  return (
    <Layout>
      <LibraryLayout title={book?.title ?? t("library.nav.bookDetails")} breadcrumb={book ? [{ label: book.title }] : []}>
        {isLoading ? (
          <SkeletonLoader variant="detail" />
        ) : !book ? (
          <EmptyState icon={<BookOpen className="h-10 w-10" />} title={t("library.emptyState.bookNotFoundTitle")} actionLabel={t("library.nav.categories")} actionTo="/library/categories" />
        ) : (
          <div className="space-y-10">
            <div className="space-y-4">
              <BookDetailsHeader book={book} categoryName={categoryName} />
              <BookTranslationSwitcher bookId={book.id} originalLanguage={book.language} />
              <BookActions
                bookId={book.id}
                bookTitle={book.title}
                coverImageUrl={book.cover_image_url}
                access={access}
                formats={book.formats}
                priceVx={book.price_vx}
                priceUsd={book.price_usd}
                lendingEnabled={book.lendingCopiesTotal != null}
                isOnShelf={isOnShelf(book.id)}
                isFavorite={isFavorite(book.id)}
                isDownloaded={isDownloaded(book.id)}
                onToggleShelf={() => toggleShelf(book.id)}
                onToggleFavorite={() => toggleFavorite(book.id)}
                onToggleDownload={() => toggleDownload(book.id)}
              />
              <AwardsBadges bookId={book.id} />
              {book.topics.length > 0 && (
                <div className="flex flex-wrap gap-1.5" role="list" aria-label={t("library.studio.organization.topics")}>
                  {book.topics.map((topic) => <Badge key={topic} variant="secondary" role="listitem">{topic}</Badge>)}
                </div>
              )}
              {connectedEntities.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5" role="list" aria-label={t("library.knowledgeGraph.connectsTo")}>
                  <span className="text-xs text-muted-foreground">{t("library.knowledgeGraph.connectsTo")}:</span>
                  {connectedEntities.map((entity) => (
                    <Link
                      key={entity.id}
                      to={`/library/knowledge-graph/${entity.slug}`}
                      role="listitem"
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${KG_ENTITY_TYPE_COLORS[entity.entity_type].badge}`}
                    >
                      {entity.name}
                    </Link>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <CitationDialog book={book} />
                {book.formats.includes("ebook") && <SearchInsideBookDialog bookId={book.id} />}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
              <div className="space-y-6">
                <BookTrailerPlayer trailerVideoUrl={book.trailerVideoUrl} />
                <BookGallerySection bookId={book.id} />
              </div>
              <AccessibilityFeaturesPanel formats={book.formats} />
            </div>

            <SeriesSection seriesId={book.seriesId} currentBookId={book.id} />

            {hasReadingProgress && (
              <div className="grid gap-4 sm:grid-cols-2">
                <ReadingProgressCard bookId={book.id} />
                {book.formats.includes("audiobook") && <AudiobookProgressCard bookId={book.id} />}
              </div>
            )}

            <BookPreviewSection bookId={book.id} chapters={chapters} />

            {chapters.length > 0 && (
              <section aria-labelledby="chapters-heading">
                <h2 id="chapters-heading" className="mb-4 text-lg font-semibold">{t("library.bookDetails.chapters")}</h2>
                <ChaptersList bookId={book.id} currentPage={progress.current_page} canAccessContent={access.canRead} />
              </section>
            )}

            <section aria-labelledby="author-heading">
              <h2 id="author-heading" className="sr-only">{t("library.explorer.aboutAuthor")}</h2>
              <AuthorSection authorId={book.author_id} />
            </section>

            <section aria-labelledby="quotes-heading">
              <h2 id="quotes-heading" className="mb-4 text-lg font-semibold">{t("library.nav.quotes")}</h2>
              <BookQuotesSection bookId={book.id} />
            </section>

            <section aria-labelledby="ai-heading">
              <h2 id="ai-heading" className="sr-only">{t("library.ai.title")}</h2>
              <BookDetailsAI bookId={book.id} chapters={chapters} />
            </section>

            <section aria-labelledby="learning-hub-heading">
              <h2 id="learning-hub-heading" className="sr-only">{t("library.learningHub.title")}</h2>
              <LearningHubBookActions bookId={book.id} bookTitle={book.title} />
            </section>

            <section aria-labelledby="reviews-heading">
              <h2 id="reviews-heading" className="mb-4 text-lg font-semibold">{t("library.nav.reviews")}</h2>
              <ReviewsList bookId={book.id} />
            </section>

            <section aria-labelledby="discussions-heading">
              <h2 id="discussions-heading" className="mb-4 text-lg font-semibold">{t("library.discussions.title")}</h2>
              <DiscussionBoard contextType="book" contextId={book.id} />
            </section>

            <FrequentlyBoughtTogether bookId={book.id} />

            {similar.length > 0 && (
              <BookRail
                title={t("library.bookDetails.sameCategory")}
                books={similar}
                emptyTitle={t("library.emptyState.noBooksTitle")}
              />
            )}
            {sameAuthorBooks.filter((b) => b.id !== book.id).length > 0 && (
              <BookRail
                title={t("library.bookDetails.sameAuthor")}
                books={sameAuthorBooks.filter((b) => b.id !== book.id)}
                emptyTitle={t("library.emptyState.noBooksTitle")}
              />
            )}
            {readersAlsoRead.length > 0 && (
              <BookRail
                title={t("library.bookDetails.readersAlsoRead")}
                books={readersAlsoRead}
                emptyTitle={t("library.emptyState.noBooksTitle")}
              />
            )}
            {relatedBooks.length > 0 && (
              <BookRail
                title={t("library.bookDetails.relatedBooks")}
                books={relatedBooks}
                emptyTitle={t("library.emptyState.noBooksTitle")}
              />
            )}
          </div>
        )}
      </LibraryLayout>
    </Layout>
  );
}
