import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Clock, TrendingUp, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { fetchCatalog } from "@/services/library/catalog";
import { fetchPopularSearches } from "@/services/library/stats";
import { fetchRecentSearches, logSearch } from "@/services/library/search";

/**
 * Smart Search: instant-as-you-type suggestions (debounced), recent
 * searches (signed-in users, real per-user history), and popular search
 * terms (public aggregate via RPC) — the Hero section's search bar.
 */
export function LibrarySmartSearch() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value.trim()), 300);
    return () => clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: suggestions = [] } = useQuery({
    queryKey: ["library", "search-suggestions", debounced],
    queryFn: () => fetchCatalog({ query: debounced, limit: 5 }),
    enabled: debounced.length >= 2,
  });

  const { data: popularSearches = [] } = useQuery({
    queryKey: ["library", "popular-searches-widget"],
    queryFn: () => fetchPopularSearches(6),
    staleTime: 30 * 60 * 1000,
  });

  const { data: recentSearches = [] } = useQuery({
    queryKey: ["library", "recent-searches", user?.id],
    queryFn: () => fetchRecentSearches(user!.id, 5),
    enabled: !!user,
    staleTime: 60 * 1000,
  });

  const runSearch = (query: string) => {
    const q = query.trim();
    if (!q) return;
    if (user) void logSearch(user.id, q, suggestions.length);
    setOpen(false);
    navigate(`/library/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <div ref={containerRef} className="relative mx-auto w-full max-w-xl">
      <form role="search" onSubmit={(e) => { e.preventDefault(); runSearch(value); }} className="flex items-center gap-2">
        <label htmlFor="library-hero-search" className="sr-only">{t("library.search.label")}</label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id="library-hero-search"
            type="search"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder={t("library.search.placeholder")}
            className="ps-9"
            autoComplete="off"
            aria-expanded={open}
            aria-controls="library-hero-search-listbox"
            role="combobox"
          />
        </div>
        <Button type="submit">{t("library.search.submit")}</Button>
      </form>

      {open && (value.length > 0 || recentSearches.length > 0 || popularSearches.length > 0) && (
        <div
          id="library-hero-search-listbox"
          role="listbox"
          className="absolute z-20 mt-2 w-full rounded-xl border bg-popover p-2 text-start shadow-lg"
        >
          {suggestions.length > 0 && (
            <div className="mb-2">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground">{t("library.search.suggestions")}</p>
              {suggestions.map((book) => (
                <button
                  key={book.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => navigate(`/library/books/${book.id}`)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate">{book.title}</span>
                  <span className="ms-auto shrink-0 truncate text-xs text-muted-foreground">{book.author_name}</span>
                </button>
              ))}
            </div>
          )}

          {recentSearches.length > 0 && (
            <div className="mb-2">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground">{t("library.search.recent")}</p>
              {recentSearches.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => runSearch(q)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate">{q}</span>
                </button>
              ))}
            </div>
          )}

          {popularSearches.length > 0 && (
            <div>
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground">{t("library.search.popular")}</p>
              <div className="flex flex-wrap gap-1.5 px-2 py-1">
                {popularSearches.map((s) => (
                  <button
                    key={s.query}
                    type="button"
                    onClick={() => runSearch(s.query)}
                    className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <TrendingUp className="h-3 w-3" aria-hidden="true" />
                    {s.query}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
