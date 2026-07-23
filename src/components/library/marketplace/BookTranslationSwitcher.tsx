import { useState } from "react";
import { Languages } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBookTranslations } from "@/hooks/library/useBookTranslations";
import { useLanguage } from "@/contexts/LanguageContext";

const NATIVE_NAMES: Record<string, string> = {
  en: "English", ar: "العربية", es: "Español", de: "Deutsch", pt: "Português",
  zh: "中文", tr: "Türkçe", fr: "Français", ru: "Русский", ur: "اردو", hi: "हिन्दी",
};

const RTL_LANGS = new Set(["ar", "ur"]);

interface BookTranslationSwitcherProps {
  originalLanguage: string;
  bookId: string;
}

/** Read-only language switcher for any visitor — picks between the book's
 *  original metadata (shown by BookDetailsHeader elsewhere on the page,
 *  untouched by this component) and any AI/human translations already
 *  generated (see the Studio Organization tab for the author-gated "create
 *  a translation" action; this component never calls the AI pipeline
 *  itself). */
export function BookTranslationSwitcher({ originalLanguage, bookId }: BookTranslationSwitcherProps) {
  const { t } = useLanguage();
  const { translations } = useBookTranslations(bookId);
  const [selected, setSelected] = useState(originalLanguage);

  if (translations.length === 0) return null;

  const active = selected === originalLanguage ? null : translations.find((tr) => tr.language_code === selected);
  const dir = RTL_LANGS.has(selected) ? "rtl" : "ltr";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Languages className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="w-56" aria-label={t("library.bookDetails.language")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={originalLanguage}>{NATIVE_NAMES[originalLanguage] ?? originalLanguage} ({t("library.translations.original")})</SelectItem>
            {translations.map((tr) => (
              <SelectItem key={tr.language_code} value={tr.language_code}>{NATIVE_NAMES[tr.language_code] ?? tr.language_code}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {active?.translated_by === "ai" && <Badge variant="outline" className="text-[10px]">{t("library.translations.aiTranslated")}</Badge>}
      </div>

      {active && (
        <Card dir={dir} className="space-y-1 p-4">
          <h2 className="text-xl font-bold">{active.title}</h2>
          {active.subtitle && <p className="text-muted-foreground">{active.subtitle}</p>}
          {active.description && <p className="text-sm leading-relaxed">{active.description}</p>}
        </Card>
      )}
    </div>
  );
}
