import { FormEvent, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface SearchBarProps {
  defaultValue?: string;
  onSearch: (query: string) => void;
  autoFocus?: boolean;
}

export function SearchBar({ defaultValue = "", onSearch, autoFocus }: SearchBarProps) {
  const { t } = useLanguage();
  const [value, setValue] = useState(defaultValue);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(value.trim());
  };

  return (
    <form role="search" onSubmit={handleSubmit} className="flex w-full items-center gap-2">
      <label htmlFor="library-search-input" className="sr-only">
        {t("library.search.label")}
      </label>
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          id="library-search-input"
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("library.search.placeholder")}
          autoFocus={autoFocus}
          className="ps-9"
        />
      </div>
      <Button type="submit">{t("library.search.submit")}</Button>
    </form>
  );
}
