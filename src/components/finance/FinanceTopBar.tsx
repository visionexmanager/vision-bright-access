import { Link, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Bell, Search, Settings, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSymbolSearch } from "@/hooks/useFinanceQuotes";
import { cn } from "@/lib/utils";

export function FinanceTopBar() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { data: results = [] } = useSymbolSearch(query);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <header
      className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4 gap-4"
      role="banner"
    >
      {/* Brand */}
      <Link
        to="/finance"
        className="flex items-center gap-2 font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
        aria-label="Visionex Finance home"
      >
        <TrendingUp className="h-5 w-5" aria-hidden="true" />
        <span className="hidden sm:inline">
          {t("finance.title") || "VX Finance"}
        </span>
      </Link>

      {/* Search */}
      <div ref={wrapperRef} className="relative flex-1 max-w-sm">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder={t("finance.searchPlaceholder") || "Search symbols, markets…"}
          className="pl-9 h-8 text-sm"
          aria-label={t("finance.searchLabel") || "Search financial instruments"}
          aria-expanded={open && results.length > 0}
          aria-autocomplete="list"
        />
        {open && query.length >= 2 && (
          <ul
            role="listbox"
            className="absolute top-full left-0 right-0 mt-1 z-50 bg-card border rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto"
          >
            {results.length === 0 ? (
              <li className="px-3 py-3 text-sm text-muted-foreground text-center" role="option" aria-selected={false}>
                No symbols found for "{query}"
              </li>
            ) : results.map((r) => (
              <li key={r.symbol} role="option">
                <button
                  type="button"
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-sm",
                    "hover:bg-muted transition-colors text-left"
                  )}
                  onClick={() => {
                    setQuery(r.symbol);
                    setOpen(false);
                    navigate(`/finance/markets?symbol=${r.symbol}`);
                  }}
                >
                  <span className="font-medium">{r.symbol}</span>
                  <span className="text-muted-foreground text-xs truncate ml-2">{r.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1" role="group" aria-label="Finance toolbar">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("finance.alerts") || "Market alerts"}
          className="h-8 w-8"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("finance.settings") || "Finance settings"}
          className="h-8 w-8"
          asChild
        >
          <Link to="/settings">
            <Settings className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </header>
  );
}
