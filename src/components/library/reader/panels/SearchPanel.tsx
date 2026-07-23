import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/library/EmptyState";
import { useLanguage } from "@/contexts/LanguageContext";
import type { InBookSearchResult } from "@/hooks/library/useInBookSearch";

interface SearchPanelProps {
  query: string;
  onQueryChange: (query: string) => void;
  results: InBookSearchResult[];
  activeIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onSelectResult: (result: InBookSearchResult, index: number) => void;
}

export function SearchPanel({ query, onQueryChange, results, activeIndex, onNext, onPrev, onSelectResult }: SearchPanelProps) {
  const { t } = useLanguage();

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder={t("library.reader.searchInBook")} className="ps-8" autoFocus />
      </div>

      {query.trim().length >= 2 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground" aria-live="polite">
          <span>{t("library.explorer.resultsCount").replace("{count}", String(results.length))}</span>
          {results.length > 0 && (
            <div className="flex items-center gap-1">
              <span>{activeIndex + 1} / {results.length}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onPrev} aria-label={t("library.reader.prevResult")}>
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onNext} aria-label={t("library.reader.nextResult")}>
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>
      )}

      {query.trim().length >= 2 && results.length === 0 ? (
        <EmptyState title={t("library.search.noResultsTitle")} className="py-8" />
      ) : (
        <ul className="space-y-1">
          {results.map((r, i) => (
            <li key={`${r.chapterId}-${r.matchIndex}`}>
              <button
                type="button"
                onClick={() => onSelectResult(r, i)}
                className={`w-full rounded-lg border px-3 py-2 text-start text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${i === activeIndex ? "border-primary bg-primary/5" : ""}`}
              >
                <p className="text-xs font-medium text-muted-foreground">{r.chapterTitle}{r.pageNumber != null ? ` · p. ${r.pageNumber}` : ""}</p>
                <p className="mt-0.5 truncate">{r.snippet}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
