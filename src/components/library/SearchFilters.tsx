import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LibraryBookFormat } from "@/lib/types/library-book";
import { cn } from "@/lib/utils";

interface SearchFiltersProps {
  activeFormat?: LibraryBookFormat;
  onFormatChange: (format: LibraryBookFormat | undefined) => void;
}

const FORMATS: LibraryBookFormat[] = ["ebook", "audiobook", "physical"];

export function SearchFilters({ activeFormat, onFormatChange }: SearchFiltersProps) {
  const { t } = useLanguage();

  return (
    <div role="group" aria-label={t("library.search.filters")} className="flex flex-wrap gap-2">
      <Button
        variant={!activeFormat ? "default" : "outline"}
        size="sm"
        onClick={() => onFormatChange(undefined)}
        aria-pressed={!activeFormat}
      >
        {t("library.search.allFormats")}
      </Button>
      {FORMATS.map((format) => (
        <Button
          key={format}
          variant={activeFormat === format ? "default" : "outline"}
          size="sm"
          onClick={() => onFormatChange(format)}
          aria-pressed={activeFormat === format}
          className={cn("capitalize")}
        >
          {t(`library.format.${format}`)}
        </Button>
      ))}
    </div>
  );
}
