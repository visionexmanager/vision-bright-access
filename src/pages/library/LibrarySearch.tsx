import { useSearchParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { LibraryLayout } from "@/components/library/layout/LibraryLayout";
import { SearchBar } from "@/components/library/SearchBar";
import { BookGrid } from "@/components/library/BookGrid";
import { AuthorCard } from "@/components/library/AuthorCard";
import { EmptyState } from "@/components/library/EmptyState";
import { Loading } from "@/components/library/Loading";
import { SemanticSearchToggle } from "@/components/library/marketplace/SemanticSearchToggle";
import { VoiceSearchButton } from "@/components/library/marketplace/VoiceSearchButton";
import { BarcodeScannerDialog } from "@/components/library/marketplace/BarcodeScannerDialog";
import { Search as SearchIcon, Headphones } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { useLibrarySearch } from "@/hooks/library/useLibrarySearch";
import { useSemanticSearch } from "@/hooks/library/useSemanticSearch";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState } from "react";

export default function LibrarySearch() {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const [semanticEnabled, setSemanticEnabled] = useState(false);
  const { results, isLoading } = useLibrarySearch(semanticEnabled ? "" : query);
  const { results: semanticResults, isSearching, search: runSemanticSearch } = useSemanticSearch();

  const handleSearch = (q: string) => {
    if (q) setSearchParams({ q });
    else setSearchParams({});
    if (semanticEnabled && q) void runSemanticSearch(q);
  };

  const effectiveResults = semanticEnabled
    ? { books: semanticResults, authors: [], audiobooks: [], isFuzzyMatch: false }
    : results;
  const effectiveLoading = semanticEnabled ? isSearching : isLoading;

  return (
    <Layout>
      <LibraryLayout title={t("library.nav.search")} breadcrumb={[{ label: t("library.nav.search") }]}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1">
            <SearchBar key={query} defaultValue={query} onSearch={handleSearch} autoFocus />
          </div>
          <VoiceSearchButton onResult={handleSearch} />
          <BarcodeScannerDialog onDetected={handleSearch} />
        </div>
        <div className="mt-3">
          <SemanticSearchToggle
            enabled={semanticEnabled}
            onChange={(next) => { setSemanticEnabled(next); if (next && query) void runSemanticSearch(query); }}
          />
        </div>

        <div className="mt-6">
          {!query ? (
            <EmptyState icon={<SearchIcon className="h-10 w-10" />} title={t("library.search.promptTitle")} description={t("library.search.promptDesc")} />
          ) : effectiveLoading ? (
            <Loading />
          ) : (
            <div className="space-y-8">
              {effectiveResults.books.length > 0 && (
                <section>
                  <h2 className="mb-4 text-lg font-semibold">{t("library.nav.home")}</h2>
                  {effectiveResults.isFuzzyMatch && (
                    <p className="mb-3 text-sm text-muted-foreground">{t("library.search.fuzzyMatchNotice")}</p>
                  )}
                  <BookGrid books={effectiveResults.books} />
                </section>
              )}
              {effectiveResults.authors.length > 0 && (
                <section>
                  <h2 className="mb-4 text-lg font-semibold">{t("library.nav.authors")}</h2>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {effectiveResults.authors.map((author) => (
                      <AuthorCard key={author.id} author={author} />
                    ))}
                  </div>
                </section>
              )}
              {effectiveResults.audiobooks.length > 0 && (
                <section>
                  <h2 className="mb-4 text-lg font-semibold">{t("library.nav.audiobooks")}</h2>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {effectiveResults.audiobooks.map((audiobook) => (
                      <Link key={audiobook.id} to={`/library/audiobooks/${audiobook.id}`}>
                        <Card className="flex items-center gap-3 p-3 hover:shadow-md">
                          <Headphones className="h-5 w-5 text-primary" aria-hidden="true" />
                          <span className="text-sm font-medium">{audiobook.title}</span>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
              {effectiveResults.books.length === 0 && effectiveResults.authors.length === 0 && effectiveResults.audiobooks.length === 0 && (
                <EmptyState icon={<SearchIcon className="h-10 w-10" />} title={t("library.search.noResultsTitle")} description={t("library.search.noResultsDesc")} />
              )}
            </div>
          )}
        </div>
      </LibraryLayout>
    </Layout>
  );
}
