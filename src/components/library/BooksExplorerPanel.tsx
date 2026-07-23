import { useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Grid3x3, List, Rows3 } from "lucide-react";
import { SearchBar } from "@/components/library/SearchBar";
import { BookGrid } from "@/components/library/BookGrid";
import { BookList } from "@/components/library/BookList";
import { BookListCompact } from "@/components/library/BookListCompact";
import { Pagination } from "@/components/library/Pagination";
import { SectionError } from "@/components/library/SectionError";
import { PopularTags } from "@/components/library/PopularTags";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useBookCatalogPaginated } from "@/hooks/library/useBookCatalog";
import { useMyShelf } from "@/hooks/library/useMyShelf";
import { useFavorites } from "@/hooks/library/useFavorites";
import { useAuthors } from "@/hooks/library/useAuthors";
import { usePublishers } from "@/hooks/library/usePublishers";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { logLibraryAnalyticsEvent } from "@/services/library/analytics";
import type { LibraryCatalogFilters, LibraryBookFormat, LibraryFileType } from "@/lib/types/library-book";

type ViewMode = "grid" | "list" | "compact";
type SortValue = NonNullable<LibraryCatalogFilters["sort"]>;

const SORT_OPTIONS: SortValue[] = ["newest", "oldest", "popular", "rating", "downloads", "reviews", "likes", "title"];
const FORMAT_OPTIONS: LibraryBookFormat[] = ["ebook", "audiobook", "physical"];
const FILE_TYPE_OPTIONS: LibraryFileType[] = ["pdf", "epub", "txt", "docx", "brf", "audio"];
const PAGE_SIZE = 24;

interface BooksExplorerPanelProps {
  /** Filters merged into every query but NOT exposed as editable UI — e.g.
   *  categoryId when this panel is embedded in the Category Details page. */
  fixedFilters?: LibraryCatalogFilters;
  showPopularTags?: boolean;
}

export function BooksExplorerPanel({ fixedFilters, showPopularTags = true }: BooksExplorerPanelProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const { authors } = useAuthors();
  const { publishers } = usePublishers();
  const { isOnShelf, toggleShelf } = useMyShelf();
  const { isFavorite, toggleFavorite } = useFavorites();
  const searchLogTimer = useRef<ReturnType<typeof setTimeout>>();

  const viewMode = (params.get("view") as ViewMode) || "grid";
  const sort = (params.get("sort") as SortValue) || "newest";
  const page = Math.max(0, parseInt(params.get("page") ?? "0", 10) || 0);
  const query = params.get("q") ?? "";
  const format = (params.get("format") as LibraryBookFormat) || undefined;
  const fileType = (params.get("fileType") as LibraryFileType) || undefined;
  const tagSlug = params.get("tag") ?? undefined;
  const isFree = params.get("free") === "1" ? true : params.get("free") === "0" ? false : undefined;
  const downloadable = params.get("downloadable") === "1" || undefined;
  const borrowable = params.get("borrowable") === "1" || undefined;
  const authorId = params.get("author") ?? undefined;
  const publisherId = params.get("publisher") ?? undefined;
  const language = params.get("lang") ?? undefined;
  const yearFrom = params.get("yearFrom") ? Number(params.get("yearFrom")) : undefined;
  const yearTo = params.get("yearTo") ? Number(params.get("yearTo")) : undefined;
  const minRating = params.get("minRating") ? Number(params.get("minRating")) : undefined;
  const minPages = params.get("minPages") ? Number(params.get("minPages")) : undefined;
  const maxPages = params.get("maxPages") ? Number(params.get("maxPages")) : undefined;

  function setParam(key: string, value: string | undefined) {
    const next = new URLSearchParams(params);
    if (value === undefined || value === "") next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page"); // any filter/sort/search change resets to page 1
    setParams(next, { replace: true });
  }

  const filters: LibraryCatalogFilters = useMemo(
    () => ({
      ...fixedFilters,
      query: query || undefined,
      sort,
      format,
      fileType,
      tagSlug,
      isFree,
      downloadable,
      borrowable,
      authorId,
      publisherId,
      language,
      yearFrom,
      yearTo,
      minRating,
      minPages,
      maxPages,
      limit: PAGE_SIZE,
      page,
    }),
    [fixedFilters, query, sort, format, fileType, tagSlug, isFree, downloadable, borrowable, authorId, publisherId, language, yearFrom, yearTo, minRating, minPages, maxPages, page]
  );

  const { books, totalPages, isLoading, error, refetch } = useBookCatalogPaginated(filters);

  // Filter/sort/search changes are logged debounced, not per keystroke.
  useEffect(() => {
    clearTimeout(searchLogTimer.current);
    searchLogTimer.current = setTimeout(() => {
      void logLibraryAnalyticsEvent(query ? "search" : "filter_change", {
        userId: user?.id ?? null,
        entityType: "explorer",
        metadata: { ...filters, limit: undefined },
      });
    }, 600);
    return () => clearTimeout(searchLogTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, sort, format, fileType, tagSlug, isFree, downloadable, borrowable, authorId, publisherId, language, yearFrom, yearTo, minRating, minPages, maxPages]);

  const clearFilters = () => {
    setParams(new URLSearchParams(query ? { q: query } : {}), { replace: true });
  };

  const activeFilterCount = [format, fileType, tagSlug, isFree, downloadable, borrowable, authorId, publisherId, language, yearFrom, yearTo, minRating, minPages, maxPages].filter((v) => v !== undefined).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <SearchBar defaultValue={query} onSearch={(q) => setParam("q", q || undefined)} />
        </div>
        <Select value={sort} onValueChange={(v) => setParam("sort", v)}>
          <SelectTrigger className="w-full sm:w-52" aria-label={t("library.explorer.sortBy")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>{t(`library.explorer.sort.${opt}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setParam("view", v)} aria-label={t("library.explorer.viewMode")}>
          <ToggleGroupItem value="grid" aria-label={t("library.explorer.viewGrid")}><Grid3x3 className="h-4 w-4" aria-hidden="true" /></ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label={t("library.explorer.viewList")}><List className="h-4 w-4" aria-hidden="true" /></ToggleGroupItem>
          <ToggleGroupItem value="compact" aria-label={t("library.explorer.viewCompact")}><Rows3 className="h-4 w-4" aria-hidden="true" /></ToggleGroupItem>
        </ToggleGroup>
      </div>

      <fieldset className="flex flex-wrap items-center gap-2 rounded-xl border p-3">
        <legend className="px-1 text-xs font-semibold text-muted-foreground">{t("library.explorer.filters")}</legend>

        {FORMAT_OPTIONS.map((f) => (
          <Button key={f} type="button" size="sm" variant={format === f ? "default" : "outline"} aria-pressed={format === f} onClick={() => setParam("format", format === f ? undefined : f)}>
            {t(`library.format.${f}`)}
          </Button>
        ))}

        <Select value={fileType ?? "any"} onValueChange={(v) => setParam("fileType", v === "any" ? undefined : v)}>
          <SelectTrigger className="w-32" aria-label={t("library.explorer.fileType")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{t("library.explorer.anyFileType")}</SelectItem>
            {FILE_TYPE_OPTIONS.map((ft) => <SelectItem key={ft} value={ft}>{ft.toUpperCase()}</SelectItem>)}
          </SelectContent>
        </Select>

        <Button type="button" size="sm" variant={isFree === true ? "default" : "outline"} aria-pressed={isFree === true} onClick={() => setParam("free", isFree === true ? undefined : "1")}>
          {t("library.format.free")}
        </Button>
        <Button type="button" size="sm" variant={isFree === false ? "default" : "outline"} aria-pressed={isFree === false} onClick={() => setParam("free", isFree === false ? undefined : "0")}>
          {t("library.home.rail.paid")}
        </Button>

        <label className="flex items-center gap-1.5 text-sm">
          <Checkbox checked={!!downloadable} onCheckedChange={(c) => setParam("downloadable", c ? "1" : undefined)} />
          {t("library.explorer.downloadable")}
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <Checkbox checked={!!borrowable} onCheckedChange={(c) => setParam("borrowable", c ? "1" : undefined)} />
          {t("library.explorer.borrowable")}
        </label>

        {authors.length > 0 && (
          <Select value={authorId ?? "any"} onValueChange={(v) => setParam("author", v === "any" ? undefined : v)}>
            <SelectTrigger className="w-40" aria-label={t("library.explorer.author")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t("library.explorer.anyAuthor")}</SelectItem>
              {authors.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {publishers.length > 0 && (
          <Select value={publisherId ?? "any"} onValueChange={(v) => setParam("publisher", v === "any" ? undefined : v)}>
            <SelectTrigger className="w-40" aria-label={t("library.explorer.publisher")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t("library.explorer.anyPublisher")}</SelectItem>
              {publishers.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        <Select value={minRating != null ? String(minRating) : "any"} onValueChange={(v) => setParam("minRating", v === "any" ? undefined : v)}>
          <SelectTrigger className="w-36" aria-label={t("library.explorer.minRating")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{t("library.explorer.anyRating")}</SelectItem>
            {[4, 3, 2, 1].map((r) => <SelectItem key={r} value={String(r)}>{r}+ ★</SelectItem>)}
          </SelectContent>
        </Select>

        {activeFilterCount > 0 && (
          <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>
            {t("library.explorer.clearFilters")} ({activeFilterCount})
          </Button>
        )}
      </fieldset>

      {error ? (
        <SectionError message={error} onRetry={refetch} />
      ) : (
        <>
          <div aria-live="polite" className="sr-only">
            {!isLoading && t("library.explorer.resultsCount").replace("{count}", String(books.length))}
          </div>
          {viewMode === "grid" && (
            <BookGrid
              books={books}
              isLoading={isLoading}
              isOnShelf={user ? isOnShelf : undefined}
              onToggleShelf={user ? toggleShelf : undefined}
              isFavorite={user ? isFavorite : undefined}
              onToggleFavorite={user ? toggleFavorite : undefined}
            />
          )}
          {viewMode === "list" && <BookList books={books} isLoading={isLoading} />}
          {viewMode === "compact" && <BookListCompact books={books} isLoading={isLoading} />}

          {!isLoading && books.length > 0 && (
            <Pagination page={page + 1} totalPages={totalPages} onPageChange={(p) => setParam("page", String(p - 1))} />
          )}
        </>
      )}

      {showPopularTags && <PopularTags />}
    </div>
  );
}
