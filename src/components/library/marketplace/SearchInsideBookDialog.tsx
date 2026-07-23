import { Link } from "react-router-dom";
import { Search as SearchIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/library/EmptyState";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSearchInsideBook } from "@/hooks/library/useSearchInsideBook";

interface SearchInsideBookDialogProps {
  bookId: string;
}

export function SearchInsideBookDialog({ bookId }: SearchInsideBookDialogProps) {
  const { t } = useLanguage();
  const { query, setQuery, results, isLoading, isSearching } = useSearchInsideBook(bookId);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <SearchIcon className="h-3.5 w-3.5" aria-hidden="true" /> {t("library.searchInside.action")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("library.searchInside.title")}</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("library.searchInside.placeholder")}
            className="ps-9"
            autoFocus
          />
        </div>

        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("library.common.loading")}</p>
        ) : isSearching && results.length === 0 ? (
          <EmptyState icon={<SearchIcon className="h-8 w-8" />} title={t("library.searchInside.noResults")} className="py-8" />
        ) : (
          <ul className="max-h-96 space-y-2 overflow-y-auto">
            {results.map((result) => (
              <li key={result.chapterId}>
                <Link
                  to={`/library/read/${bookId}?chapter=${result.chapterId}`}
                  className="block rounded-lg border p-3 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{result.chapterTitle}</p>
                  <p>
                    {result.snippetParts.map((part, i) =>
                      part.matched ? <mark key={i} className="bg-primary/20 text-foreground">{part.text}</mark> : <span key={i}>{part.text}</span>
                    )}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
