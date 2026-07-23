import { useMemo } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Headphones, Library as LibraryIcon, Sparkles, Quote as QuoteIcon, Trophy } from "lucide-react";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { LibrarySmartSearch } from "@/components/library/LibrarySmartSearch";
import { BookRail } from "@/components/library/BookRail";
import { CategoryCard } from "@/components/library/CategoryCard";
import { AuthorCard } from "@/components/library/AuthorCard";
import { QuoteCard } from "@/components/library/QuoteCard";
import { ChallengeCard } from "@/components/library/ChallengeCard";
import { ContinueReadingCard } from "@/components/library/ContinueReadingCard";
import { VXRewardCard } from "@/components/library/VXRewardCard";
import { StatsBar } from "@/components/library/StatsBar";
import { SectionError } from "@/components/library/SectionError";
import { SkeletonLoader } from "@/components/library/SkeletonLoader";
import { EmptyState } from "@/components/library/EmptyState";
import { CollectionRail } from "@/components/library/marketplace/CollectionRail";
import { PublisherCard } from "@/components/library/marketplace/PublisherCard";
import { AchievementsPanel } from "@/components/library/marketplace/AchievementsPanel";
import { DailyRewardClaimButton } from "@/components/library/marketplace/DailyRewardClaimButton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/hooks/useAdmin";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";

import { useLibraryCategories } from "@/hooks/library/useBookCatalog";
import { useBookRails } from "@/hooks/library/useBookRails";
import { useMyShelf } from "@/hooks/library/useMyShelf";
import { useContinueReading } from "@/hooks/library/useContinueReading";
import { useRecommendations } from "@/hooks/library/useRecommendations";
import { useTrendingBooks } from "@/hooks/library/useTrendingBooks";
import { useAudiobooks } from "@/hooks/library/useAudiobooks";
import { useFeaturedAuthors } from "@/hooks/library/useFeaturedAuthors";
import { useDailyQuote } from "@/hooks/library/useDailyQuote";
import { useReadingChallenges } from "@/hooks/library/useReadingChallenges";
import { useVXRewardProgress } from "@/hooks/library/useVXRewardProgress";
import { useHomeStats } from "@/hooks/library/useHomeStats";
import { usePopularPublishers } from "@/hooks/library/usePublisherProfile";

export default function LibraryHome() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();

  // ── Empty-state CTA: point admins at the admin tools, everyone else at
  //    the category browser — same fallback reused across every empty rail.
  const emptyActionLabel = isAdmin ? t("library.home.addFirstBook") : t("library.home.browseCategories");
  const emptyActionTo = isAdmin ? "/library/admin" : "/library/categories";

  // ── Hero / catalog-wide data ─────────────────────────────────────────────
  const { stats: homeStats, isLoading: statsLoading } = useHomeStats();
  const { categories, isLoading: categoriesLoading } = useLibraryCategories();
  const { isOnShelf, toggleShelf } = useMyShelf();

  // ── Personal sections (signed-in only) ───────────────────────────────────
  const { items: continueReadingItems, isLoading: continueReadingLoading, error: continueReadingError, refetch: refetchContinueReading } = useContinueReading();
  const continueListeningItems = useMemo(
    () => continueReadingItems.filter((item) => item.book.formats.includes("audiobook")),
    [continueReadingItems]
  );
  const { books: recommendedBooks, isLoading: recommendationsLoading, error: recommendationsError, refetch: refetchRecommendations } = useRecommendations();
  const vxProgress = useVXRewardProgress();

  // ── Trending / popular ────────────────────────────────────────────────────
  const { books: trendingBooks, isLoading: trendingLoading, error: trendingError, refetch: refetchTrending } = useTrendingBooks(12, 7);
  const { books: popularMonthBooks, isLoading: popularMonthLoading, error: popularMonthError, refetch: refetchPopularMonth } = useTrendingBooks(12, 30);

  // ── New audiobooks / featured authors / daily quote / challenges ────────
  const { audiobooks: newAudiobooks, isLoading: audiobooksLoading } = useAudiobooks();
  const { authors: featuredAuthors, isLoading: authorsLoading } = useFeaturedAuthors(6);
  const { quote: dailyQuote, isLoading: quoteLoading } = useDailyQuote();
  const { challenges, isLoading: challengesLoading } = useReadingChallenges();
  const { publishers: popularPublishers, isLoading: publishersLoading } = usePopularPublishers(6);

  // ── The ~15 named catalog rails, config-driven (one BookRail component,
  //    one useQueries call via useBookRails — see that hook's header for why
  //    this can't be N separate useBookCatalog() calls in a loop). ─────────
  const railConfigs = useMemo(
    () => [
      { key: "newest", filters: { sort: "newest" as const, limit: 12 } },
      { key: "mostRead", filters: { sort: "popular" as const, limit: 12 } },
      { key: "topRated", filters: { sort: "rating" as const, limit: 12 } },
      { key: "free", filters: { isFree: true, limit: 12 } },
      { key: "paid", filters: { isFree: false, limit: 12 } },
      { key: "audiobooksFormat", filters: { format: "audiobook" as const, limit: 12 } },
      { key: "novels", filters: { categorySlug: "fiction", limit: 12 } },
      { key: "children", filters: { categorySlug: "children-books", limit: 12 } },
      { key: "educational", filters: { categorySlug: "educational", limit: 12 } },
      { key: "ai", filters: { categorySlug: "ai", limit: 12 } },
      { key: "programming", filters: { categorySlug: "programming", limit: 12 } },
      { key: "business", filters: { categorySlug: "business", limit: 12 } },
      { key: "selfDevelopment", filters: { categorySlug: "self-development", limit: 12 } },
      { key: "magazines", filters: { categorySlug: "magazines", limit: 12 } },
      { key: "research", filters: { categorySlug: "research", limit: 12 } },
      { key: "flashDeals", filters: { flashDeal: true as const, limit: 12 } },
      { key: "comingSoon", filters: { comingSoon: true as const, limit: 12 } },
    ],
    []
  );
  const rails = useBookRails(railConfigs);
  const railByKey = useMemo(() => Object.fromEntries(rails.map((r) => [r.key, r])), [rails]);

  const railDefs: { key: string; titleKey: string; viewAllHref: string }[] = [
    { key: "newest", titleKey: "library.home.rail.newest", viewAllHref: "/library/books?sort=newest" },
    { key: "mostRead", titleKey: "library.home.rail.mostRead", viewAllHref: "/library/books?sort=popular" },
    { key: "topRated", titleKey: "library.home.rail.topRated", viewAllHref: "/library/books?sort=rating" },
    { key: "free", titleKey: "library.home.rail.free", viewAllHref: "/library/books?free=1" },
    { key: "paid", titleKey: "library.home.rail.paid", viewAllHref: "/library/books?free=0" },
    { key: "audiobooksFormat", titleKey: "library.home.rail.audiobooksFormat", viewAllHref: "/library/audiobooks" },
    { key: "novels", titleKey: "library.home.rail.novels", viewAllHref: "/library/categories/fiction" },
    { key: "children", titleKey: "library.home.rail.children", viewAllHref: "/library/categories/children-books" },
    { key: "educational", titleKey: "library.home.rail.educational", viewAllHref: "/library/categories/educational" },
    { key: "ai", titleKey: "library.home.rail.ai", viewAllHref: "/library/categories/ai" },
    { key: "programming", titleKey: "library.home.rail.programming", viewAllHref: "/library/categories/programming" },
    { key: "business", titleKey: "library.home.rail.business", viewAllHref: "/library/categories/business" },
    { key: "selfDevelopment", titleKey: "library.home.rail.selfDevelopment", viewAllHref: "/library/categories/self-development" },
    { key: "magazines", titleKey: "library.home.rail.magazines", viewAllHref: "/library/categories/magazines" },
    { key: "research", titleKey: "library.home.rail.research", viewAllHref: "/library/categories/research" },
    { key: "flashDeals", titleKey: "library.home.rail.flashDeals", viewAllHref: "/library/books?flashDeal=1" },
    { key: "comingSoon", titleKey: "library.home.rail.comingSoon", viewAllHref: "/library/books?comingSoon=1" },
  ];

  // ── SEO: title/meta/canonical + JSON-LD ItemList of the newest books ────
  const structuredData = useMemo(() => {
    const newestBooks = railByKey.newest?.books ?? [];
    return {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: t("library.home.heroTitle"),
      description: t("library.home.heroSubtitle"),
      mainEntity: {
        "@type": "ItemList",
        itemListElement: newestBooks.slice(0, 10).map((book, index) => ({
          "@type": "ListItem",
          position: index + 1,
          item: {
            "@type": "Book",
            name: book.title,
            author: { "@type": "Person", name: book.author_name },
            url: `${window.location.origin}/library/books/${book.id}`,
          },
        })),
      },
    };
  }, [railByKey.newest?.books, t]);

  useDocumentHead({
    title: `${t("library.home.heroTitle")} — Visionex`,
    description: t("library.home.heroSubtitle"),
    canonicalPath: "/library",
    structuredData,
  });

  return (
    <Layout>
      <LibraryLayout title={t("library.nav.home")}>
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="mb-10 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 sm:p-10">
          <h1 className="text-2xl font-bold sm:text-3xl">{t("library.home.heroTitle")}</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">{t("library.home.heroSubtitle")}</p>

          <div className="mt-6">
            <LibrarySmartSearch />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/library/categories">
                <BookOpen className="me-2 h-4 w-4" aria-hidden="true" />
                {t("library.home.browseBooks")}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/library/audiobooks">
                <Headphones className="me-2 h-4 w-4" aria-hidden="true" />
                {t("library.nav.audiobooks")}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/library/my-library">
                <LibraryIcon className="me-2 h-4 w-4" aria-hidden="true" />
                {t("library.nav.myLibrary")}
              </Link>
            </Button>
          </div>

          <div className="mt-8">
            <StatsBar stats={homeStats} isLoading={statsLoading} />
          </div>
        </section>

        {/* ── Continue Reading (signed-in only) ───────────────────────────── */}
        {user && (
          <section className="mb-10" aria-labelledby="continue-reading-heading">
            <h2 id="continue-reading-heading" className="mb-4 text-lg font-semibold">{t("library.home.continueReading")}</h2>
            {continueReadingError ? (
              <SectionError message={continueReadingError} onRetry={refetchContinueReading} />
            ) : continueReadingLoading ? (
              <SkeletonLoader variant="list" count={3} />
            ) : continueReadingItems.length === 0 ? (
              <EmptyState icon={<BookOpen className="h-8 w-8" />} title={t("library.emptyState.noContinueReadingTitle")} description={t("library.emptyState.noContinueReadingDesc")} actionLabel={t("library.home.browseBooks")} actionTo="/library/categories" className="py-8" />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list">
                {continueReadingItems.slice(0, 6).map((item) => (
                  <div role="listitem" key={item.book.id}>
                    <ContinueReadingCard item={item} />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Continue Listening (signed-in only) ─────────────────────────── */}
        {user && continueListeningItems.length > 0 && (
          <section className="mb-10" aria-labelledby="continue-listening-heading">
            <h2 id="continue-listening-heading" className="mb-4 text-lg font-semibold">{t("library.home.continueListening")}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list">
              {continueListeningItems.slice(0, 6).map((item) => (
                <div role="listitem" key={item.book.id}>
                  <ContinueReadingCard item={item} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Personalized Recommendations (signed-in only) ───────────────── */}
        {user && (
          <BookRail
            title={t("library.home.recommendedForYou")}
            books={recommendedBooks}
            isLoading={recommendationsLoading}
            error={recommendationsError}
            onRetry={refetchRecommendations}
            isOnShelf={isOnShelf}
            onToggleShelf={toggleShelf}
            emptyTitle={t("library.home.noRecommendationsTitle")}
            emptyDescription={t("library.home.noRecommendationsDesc")}
          />
        )}

        {/* ── Categories grid ──────────────────────────────────────────────── */}
        <section className="mb-10" aria-labelledby="categories-heading">
          <h2 id="categories-heading" className="mb-4 text-lg font-semibold">{t("library.nav.categories")}</h2>
          {categoriesLoading ? (
            <SkeletonLoader variant="grid" count={8} />
          ) : categories.length === 0 ? (
            <EmptyState icon={<Sparkles className="h-8 w-8" />} title={t("library.emptyState.noBooksTitle")} actionLabel={emptyActionLabel} actionTo={emptyActionTo} className="py-8" />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4" role="list">
              {categories.map((category) => (
                <div role="listitem" key={category.id}>
                  <CategoryCard category={category} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Curated collections (Editor's Choice / Staff Picks / Award
             Winners / Seasonal) — each renders zero or more BookRails,
             skipping types with no active collections. ─────────────────── */}
        <CollectionRail type="editors_choice" isOnShelf={isOnShelf} onToggleShelf={user ? toggleShelf : undefined} />
        <CollectionRail type="staff_pick" isOnShelf={isOnShelf} onToggleShelf={user ? toggleShelf : undefined} />
        <CollectionRail type="award_winner" isOnShelf={isOnShelf} onToggleShelf={user ? toggleShelf : undefined} />
        <CollectionRail type="seasonal" isOnShelf={isOnShelf} onToggleShelf={user ? toggleShelf : undefined} />

        {/* ── Trending / Popular ───────────────────────────────────────────── */}
        <BookRail
          title={t("library.home.rail.trending")}
          books={trendingBooks}
          isLoading={trendingLoading}
          error={trendingError}
          onRetry={refetchTrending}
          isOnShelf={isOnShelf}
          onToggleShelf={user ? toggleShelf : undefined}
          emptyTitle={t("library.emptyState.noBooksTitle")}
          emptyDescription={t("library.emptyState.noBooksDesc")}
          emptyActionLabel={emptyActionLabel}
          emptyActionTo={emptyActionTo}
        />
        <BookRail
          title={t("library.home.rail.popularMonth")}
          books={popularMonthBooks}
          isLoading={popularMonthLoading}
          error={popularMonthError}
          onRetry={refetchPopularMonth}
          isOnShelf={isOnShelf}
          onToggleShelf={user ? toggleShelf : undefined}
          emptyTitle={t("library.emptyState.noBooksTitle")}
          emptyDescription={t("library.emptyState.noBooksDesc")}
          emptyActionLabel={emptyActionLabel}
          emptyActionTo={emptyActionTo}
        />

        {/* ── The ~15 named catalog rails ──────────────────────────────────── */}
        {railDefs.map((def) => {
          const rail = railByKey[def.key];
          return (
            <BookRail
              key={def.key}
              title={t(def.titleKey)}
              books={rail?.books ?? []}
              isLoading={rail?.isLoading}
              error={rail?.error}
              onRetry={rail?.refetch}
              viewAllHref={def.viewAllHref}
              isOnShelf={isOnShelf}
              onToggleShelf={user ? toggleShelf : undefined}
              emptyTitle={t("library.emptyState.noBooksTitle")}
              emptyDescription={t("library.emptyState.noBooksDesc")}
              emptyActionLabel={emptyActionLabel}
              emptyActionTo={emptyActionTo}
            />
          );
        })}

        {/* ── New Audiobooks ───────────────────────────────────────────────── */}
        <section className="mb-10" aria-labelledby="new-audiobooks-heading">
          <h2 id="new-audiobooks-heading" className="mb-4 text-lg font-semibold">{t("library.home.rail.newAudiobooks")}</h2>
          {audiobooksLoading ? (
            <SkeletonLoader variant="list" count={4} />
          ) : newAudiobooks.length === 0 ? (
            <EmptyState icon={<Headphones className="h-8 w-8" />} title={t("library.emptyState.noAudiobooksTitle")} actionLabel={emptyActionLabel} actionTo={emptyActionTo} className="py-8" />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" role="list">
              {newAudiobooks.slice(0, 6).map((audiobook) => (
                <Link key={audiobook.id} to={`/library/audiobooks/${audiobook.id}`} role="listitem" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl block">
                  <div className="flex items-center gap-3 rounded-xl border bg-card p-3 hover:shadow-md">
                    <Headphones className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{audiobook.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{audiobook.author_name}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── Featured Authors ─────────────────────────────────────────────── */}
        <section className="mb-10" aria-labelledby="featured-authors-heading">
          <h2 id="featured-authors-heading" className="mb-4 text-lg font-semibold">{t("library.home.featuredAuthors")}</h2>
          {authorsLoading ? (
            <SkeletonLoader variant="grid" count={6} />
          ) : featuredAuthors.length === 0 ? (
            <EmptyState icon={<Sparkles className="h-8 w-8" />} title={t("library.emptyState.noAuthorsTitle")} className="py-8" />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6" role="list">
              {featuredAuthors.map((author) => (
                <div role="listitem" key={author.id}>
                  <AuthorCard author={author} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Popular Publishers ───────────────────────────────────────────── */}
        <section className="mb-10" aria-labelledby="popular-publishers-heading">
          <h2 id="popular-publishers-heading" className="mb-4 text-lg font-semibold">{t("library.home.popularPublishers")}</h2>
          {publishersLoading ? (
            <SkeletonLoader variant="grid" count={6} />
          ) : popularPublishers.length === 0 ? (
            <EmptyState icon={<Sparkles className="h-8 w-8" />} title={t("library.emptyState.noPublishersTitle")} className="py-8" />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6" role="list">
              {popularPublishers.map((publisher) => (
                <div role="listitem" key={publisher.id}>
                  <PublisherCard publisher={publisher} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Daily Quote ──────────────────────────────────────────────────── */}
        <section className="mb-10" aria-labelledby="daily-quote-heading">
          <h2 id="daily-quote-heading" className="mb-4 text-lg font-semibold">{t("library.home.dailyQuote")}</h2>
          {quoteLoading ? (
            <SkeletonLoader variant="grid" count={1} />
          ) : !dailyQuote ? (
            <EmptyState icon={<QuoteIcon className="h-8 w-8" />} title={t("library.emptyState.noQuotesTitle")} className="py-8" />
          ) : (
            <div className="max-w-md">
              <QuoteCard quote={dailyQuote} />
            </div>
          )}
        </section>

        {/* ── Reading Challenges ───────────────────────────────────────────── */}
        <section className="mb-10" aria-labelledby="challenges-heading">
          <h2 id="challenges-heading" className="mb-4 text-lg font-semibold">{t("library.home.challenges")}</h2>
          {challengesLoading ? (
            <SkeletonLoader variant="grid" count={3} />
          ) : challenges.length === 0 ? (
            <EmptyState icon={<Trophy className="h-8 w-8" />} title={t("library.home.noChallengesTitle")} className="py-8" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
              {challenges.map((challenge) => (
                <div role="listitem" key={challenge.id}>
                  <ChallengeCard challenge={challenge} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── VX Rewards ───────────────────────────────────────────────────── */}
        {user && (
          <section className="mb-10" aria-labelledby="vx-rewards-heading">
            <h2 id="vx-rewards-heading" className="mb-4 text-lg font-semibold">{t("library.vxReward.title")}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <VXRewardCard />
              <div className="rounded-xl border bg-card p-4">
                <p className="mb-1 text-sm text-muted-foreground">{t("library.home.nextReward")}</p>
                {vxProgress.nextTier !== null ? (
                  <>
                    <Progress value={vxProgress.percentToNext} aria-label={`${vxProgress.percentToNext}%`} />
                    <p className="mt-2 text-sm">
                      {t("library.home.vxRemaining").replace("{amount}", vxProgress.remaining.toLocaleString()).replace("{tier}", vxProgress.nextTier.toLocaleString())}
                    </p>
                  </>
                ) : (
                  <p className="text-sm font-medium text-primary">{t("library.home.allTiersReached")}</p>
                )}
              </div>
            </div>
            <div className="mt-4">
              <DailyRewardClaimButton />
            </div>
          </section>
        )}

        {/* ── Achievements ─────────────────────────────────────────────────── */}
        {user && (
          <section className="mb-10" aria-labelledby="achievements-heading">
            <h2 id="achievements-heading" className="mb-4 text-lg font-semibold">{t("library.achievements.title")}</h2>
            <AchievementsPanel />
          </section>
        )}
      </LibraryLayout>
    </Layout>
  );
}
