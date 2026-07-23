import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { useEntitySearch } from "@/hooks/library/useKgEntity";
import { KG_ENTITY_TYPE_COLORS } from "@/components/library/knowledgeGraph/entityTypeStyles";

interface KgEntitySearchBoxProps {
  onSelect: (slug: string) => void;
}

export function KgEntitySearchBox({ onSelect }: KgEntitySearchBoxProps) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const { results, isLoading } = useEntitySearch(query);

  return (
    <div className="relative">
      <label htmlFor="kg-entity-search" className="sr-only">{t("library.knowledgeGraph.searchLabel")}</label>
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          id="kg-entity-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("library.knowledgeGraph.searchPlaceholder")}
          className="ps-9"
        />
      </div>
      {query.trim().length >= 2 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
          {isLoading ? (
            <p className="p-3 text-sm text-muted-foreground">{t("library.common.loading")}</p>
          ) : results.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">{t("library.knowledgeGraph.noResults")}</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto py-1">
              {results.map((entity) => (
                <li key={entity.id}>
                  <button
                    type="button"
                    onClick={() => { onSelect(entity.slug); setQuery(""); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-accent"
                  >
                    <span className={`rounded-full px-2 py-0.5 text-xs ${KG_ENTITY_TYPE_COLORS[entity.entity_type].badge}`}>
                      {t(`library.knowledgeGraph.entityType.${entity.entity_type}`)}
                    </span>
                    {entity.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
