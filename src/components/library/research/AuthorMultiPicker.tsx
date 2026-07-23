import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { searchAuthorsByName, type LibraryAuthorSearchHit } from "@/services/library/researchWorkspace";
import { useLanguage } from "@/contexts/LanguageContext";

interface AuthorMultiPickerProps {
  selected: LibraryAuthorSearchHit[];
  onChange: (authors: LibraryAuthorSearchHit[]) => void;
  minSelections?: number;
}

export function AuthorMultiPicker({ selected, onChange, minSelections }: AuthorMultiPickerProps) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<LibraryAuthorSearchHit[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    const timeout = setTimeout(() => {
      void searchAuthorsByName(term).then((results) => setHits(results.filter((r) => !selected.some((s) => s.id === r.id))));
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, selected]);

  const add = (author: LibraryAuthorSearchHit) => {
    onChange([...selected, author]);
    setQuery("");
    setHits([]);
    setIsOpen(false);
  };

  const remove = (id: string) => onChange(selected.filter((a) => a.id !== id));

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 150)}
          placeholder={t("library.researchAssistant.searchAuthors")}
          className="pl-8"
        />
        {isOpen && hits.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
            {hits.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-sm hover:bg-accent"
                  onMouseDown={(e) => { e.preventDefault(); add(hit); }}
                >
                  {hit.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((author) => (
            <Badge key={author.id} variant="secondary" className="gap-1 pe-1">
              {author.name}
              <Button type="button" variant="ghost" size="icon" className="h-4 w-4" onClick={() => remove(author.id)} aria-label={t("library.researchAssistant.remove")}>
                <X className="h-3 w-3" aria-hidden="true" />
              </Button>
            </Badge>
          ))}
        </div>
      )}
      {minSelections && selected.length < minSelections && (
        <p className="text-xs text-muted-foreground">{t("library.researchAssistant.minSelections").replace("{count}", String(minSelections))}</p>
      )}
    </div>
  );
}
