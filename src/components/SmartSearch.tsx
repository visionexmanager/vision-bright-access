/**
 * SmartSearch — drop-in semantic search box (RAG) for products / content.
 *
 * Usage:
 *   <SmartSearch source="products" />               // marketplace
 *   <SmartSearch source="content_items" />          // learning content
 *   <SmartSearch />                                  // both
 *
 * On select it navigates to the product page by default; pass `onSelect`
 * to override.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSmartSearch } from "@/hooks/useSmartSearch";
import type { SearchResult } from "@/lib/types";

interface ResultItem {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  category?: string;
}

interface Props {
  source?: "products" | "content_items";
  placeholder?: string;
  onSelect?: (result: SearchResult<ResultItem>) => void;
}

export function SmartSearch({ source, placeholder, onSelect }: Props) {
  const { lang } = useLanguage();
  const isAr = lang === "ar";
  const navigate = useNavigate();
  const { query, setQuery, results, loading } = useSmartSearch<ResultItem>(source);
  const [open, setOpen] = useState(false);

  const ph = placeholder ?? (isAr ? "ابحث بالمعنى…" : "Search by meaning…");

  const handleSelect = (r: SearchResult<ResultItem>) => {
    setOpen(false);
    if (onSelect) { onSelect(r); return; }
    if (r.source_table === "products") navigate(`/product/${r.id}`);
    else navigate("/content");
  };

  return (
    <div className="relative w-full" dir={isAr ? "rtl" : "ltr"}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" style={{ [isAr ? "right" : "left"]: "0.75rem" }} />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={ph}
          className={isAr ? "pr-9" : "pl-9"}
          aria-label={ph}
        />
        {loading && (
          <Loader2 className="absolute top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" style={{ [isAr ? "left" : "right"]: "0.75rem" }} />
        )}
      </div>

      {open && query.trim().length >= 2 && (results.length > 0 || !loading) && (
        <div
          className="absolute z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border bg-popover p-1 shadow-lg"
          role="listbox"
        >
          {results.length === 0 && !loading && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              {isAr ? "لا نتائج" : "No results"}
            </p>
          )}
          {results.map((r) => {
            const label = r.item.name ?? r.item.title ?? "";
            return (
              <button
                key={`${r.source_table}-${r.id}`}
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => handleSelect(r)}
                className="flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-start transition-colors hover:bg-muted"
              >
                <span className="text-sm font-medium">{label}</span>
                {r.item.category && (
                  <span className="text-xs text-muted-foreground">{r.item.category}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
