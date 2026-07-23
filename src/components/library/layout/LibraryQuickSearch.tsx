import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";

export function LibraryQuickSearch() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [value, setValue] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) navigate(`/library/search?q=${encodeURIComponent(value.trim())}`);
  };

  return (
    <form role="search" onSubmit={handleSubmit} className="relative hidden w-full max-w-xs sm:block">
      <label htmlFor="library-quick-search" className="sr-only">
        {t("library.search.label")}
      </label>
      <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        id="library-quick-search"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("library.search.placeholder")}
        className="ps-9"
      />
    </form>
  );
}
