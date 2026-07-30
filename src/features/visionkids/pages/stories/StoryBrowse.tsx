import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Search as SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDocumentHead } from "@/hooks/useDocumentHead";
import { useStoryCategories, useStoriesByCategory } from "@/features/visionkids/hooks/stories/useStoryCatalog";
import { useSearchStories, useLogSearchQuery } from "@/features/visionkids/hooks/stories/useStoryDiscovery";
import { StoryCard } from "@/features/visionkids/components/stories/StoryCard";
import type { AgeGroup, Story } from "@/features/visionkids/types/stories.types";

const PAGE_SIZE = 24;

export default function StoryBrowse() {
  const { t } = useLanguage();
  const { categorySlug } = useParams<{ categorySlug?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSearchMode = !categorySlug;

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [ageGroup, setAgeGroup] = useState<AgeGroup | "all">("all");
  const [allStories, setAllStories] = useState<Story[]>([]);
  const [page, setPage] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const logSearch = useLogSearchQuery();

  const { data: categories = [] } = useStoryCategories();
  const category = categories.find((c) => c.slug === categorySlug);

  const categoryResult = useStoriesByCategory(isSearchMode ? undefined : categorySlug, page, PAGE_SIZE);
  const searchResult = useSearchStories(
    { query, ageGroup: ageGroup === "all" ? undefined : ageGroup },
    page,
    PAGE_SIZE
  );

  const result = isSearchMode ? searchResult.data : categoryResult.data;
  const isLoading = isSearchMode ? searchResult.isLoading : categoryResult.isLoading;

  useDocumentHead({
    title: isSearchMode ? t("kids.stories.searchTitle") : category?.name ?? t("kids.stories.categoriesTitle"),
    description: t("kids.stories.meta.description"),
    canonicalPath: isSearchMode ? "/kids/stories/search" : `/kids/stories/category/${categorySlug}`,
  });

  // Reset accumulated results whenever the query/filters/category change.
  useEffect(() => {
    setPage(0);
    setAllStories([]);
  }, [query, ageGroup, categorySlug]);

  useEffect(() => {
    if (result?.stories) {
      setAllStories((prev) => (page === 0 ? result.stories : [...prev, ...result.stories]));
    }
  }, [result?.stories, page]);

  // Infinite scroll — IntersectionObserver on a sentinel at the bottom of the grid.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !result) return;
    const hasMore = allStories.length < (result.count ?? 0);
    if (!hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setPage((p) => p + 1);
    }, { rootMargin: "200px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [allStories.length, result]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams(query ? { q: query } : {});
    if (query.trim()) logSearch.mutate(query.trim());
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="font-heading text-3xl font-extrabold">
        {isSearchMode ? t("kids.stories.searchTitle") : category?.name}
      </h1>

      {isSearchMode && (
        <form onSubmit={handleSearchSubmit} role="search" className="mt-4 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <SearchIcon className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("kids.stories.searchPlaceholder")}
              className="ps-9"
              aria-label={t("kids.stories.searchTitle")}
            />
          </div>
          <Select value={ageGroup} onValueChange={(v) => setAgeGroup(v as AgeGroup | "all")}>
            <SelectTrigger className="w-36"><SelectValue placeholder={t("kids.stories.ageGroup")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("kids.stories.allAges")}</SelectItem>
              <SelectItem value="3-5">3-5</SelectItem>
              <SelectItem value="6-8">6-8</SelectItem>
              <SelectItem value="9-12">9-12</SelectItem>
            </SelectContent>
          </Select>
        </form>
      )}

      {isLoading && page === 0 ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6" aria-busy="true">
          {Array.from({ length: 12 }).map((_, i) => <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : allStories.length === 0 ? (
        <p className="mt-8 text-center text-muted-foreground">{t("kids.stories.noResults")}</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {allStories.map((story) => <StoryCard key={story.id} story={story} />)}
        </div>
      )}

      <div ref={sentinelRef} className="h-4" aria-hidden="true" />
    </div>
  );
}
