import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Search as SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useGameCategories, useGamesByCategory, useSearchGames } from "@/features/visionkids/hooks/games/useGameCatalog";
import { GameCard } from "@/features/visionkids/components/games/GameCard";
import type { Game } from "@/features/visionkids/types/games.types";

const PAGE_SIZE = 24;

export default function GameBrowse() {
  const { t } = useLanguage();
  const { categorySlug } = useParams<{ categorySlug?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSearchMode = !categorySlug;

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [allGames, setAllGames] = useState<Game[]>([]);
  const [page, setPage] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data: categories = [] } = useGameCategories();
  const category = categories.find((c) => c.slug === categorySlug);

  const categoryResult = useGamesByCategory(isSearchMode ? undefined : categorySlug, page, PAGE_SIZE);
  const searchResult = useSearchGames(query, page, PAGE_SIZE);

  const result = isSearchMode ? searchResult.data : categoryResult.data;
  const isLoading = isSearchMode ? searchResult.isLoading : categoryResult.isLoading;

  useDocumentHead({
    title: isSearchMode ? t("kids.games.searchTitle") : category?.name ?? t("kids.games.categoriesTitle"),
    description: t("kids.games.meta.description"),
    canonicalPath: isSearchMode ? "/kids/games/search" : `/kids/games/category/${categorySlug}`,
  });

  useEffect(() => { setPage(0); setAllGames([]); }, [query, categorySlug]);

  useEffect(() => {
    if (result?.games) setAllGames((prev) => (page === 0 ? result.games : [...prev, ...result.games]));
  }, [result?.games, page]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !result) return;
    if (allGames.length >= (result.count ?? 0)) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setPage((p) => p + 1);
    }, { rootMargin: "200px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [allGames.length, result]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams(query ? { q: query } : {});
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="font-heading text-3xl font-extrabold">{isSearchMode ? t("kids.games.searchTitle") : category?.name}</h1>

      {isSearchMode && (
        <form onSubmit={handleSearchSubmit} role="search" className="mt-4 max-w-sm">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("kids.games.searchPlaceholder")} className="ps-9" aria-label={t("kids.games.searchTitle")} />
          </div>
        </form>
      )}

      {isLoading && page === 0 ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6" aria-busy="true">
          {Array.from({ length: 12 }).map((_, i) => <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : allGames.length === 0 ? (
        <p className="mt-8 text-center text-muted-foreground">{t("kids.games.noResults")}</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {allGames.map((game) => <GameCard key={game.id} game={game} />)}
        </div>
      )}

      <div ref={sentinelRef} className="h-4" aria-hidden="true" />
    </div>
  );
}
