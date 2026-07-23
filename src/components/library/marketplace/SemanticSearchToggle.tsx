import { Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";

interface SemanticSearchToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

/** Toggles between keyword search (fetchCatalog) and meaning-based search
 *  (library-semantic-search, pgvector similarity) for the same search box —
 *  the caller decides which query function to run based on this flag. */
export function SemanticSearchToggle({ enabled, onChange }: SemanticSearchToggleProps) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-2">
      <Switch id="semantic-search-toggle" checked={enabled} onCheckedChange={onChange} />
      <Label htmlFor="semantic-search-toggle" className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        {t("library.search.semanticToggle")}
      </Label>
    </div>
  );
}
