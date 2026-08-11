import { useLanguage, Lang } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe } from "lucide-react";

const languages: { code: Lang; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "ar", label: "العربية — Arabic", flag: "🇸🇦" },
  { code: "ur", label: "اردو — Urdu", flag: "🇵🇰" },
  { code: "hi", label: "हिन्दी — Hindi", flag: "🇮🇳" },
  { code: "id", label: "Bahasa Indonesia — Indonesian", flag: "🇮🇩" },
  { code: "ja", label: "日本語 — Japanese", flag: "🇯🇵" },
  { code: "it", label: "Italiano — Italian", flag: "🇮🇹" },
  { code: "ko", label: "한국어 — Korean", flag: "🇰🇷" },
  { code: "es", label: "Español — Spanish", flag: "🇪🇸" },
  { code: "de", label: "Deutsch — German", flag: "🇩🇪" },
  { code: "pt", label: "Português — Portuguese", flag: "🇧🇷" },
  { code: "zh", label: "中文 — Chinese", flag: "🇨🇳" },
  { code: "tr", label: "Türkçe — Turkish", flag: "🇹🇷" },
  { code: "fr", label: "Français — French", flag: "🇫🇷" },
  { code: "ru", label: "Русский — Russian", flag: "🇷🇺" },
];

export function LanguageSwitcher() {
  const { lang, setLang, t } = useLanguage();
  const current = languages.find((l) => l.code === lang);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("settings.selectLang")}
          className="gap-1.5 text-sm px-2"
        >
          <span className="text-base" aria-hidden="true">{current?.flag}</span>
          <span className="hidden sm:inline">{current?.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
        {languages.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => setLang(l.code)}
            className={`text-base gap-2 ${lang === l.code ? "bg-primary/10 font-semibold" : ""}`}
          >
            <span aria-hidden="true">{l.flag}</span>
            <span>{l.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
