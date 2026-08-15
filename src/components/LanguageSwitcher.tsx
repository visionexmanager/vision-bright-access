import { useLanguage, Lang } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe } from "lucide-react";

// `label` is "native name — English name" and stays that way inside the menu,
// where the English half is what lets someone find a language they cannot yet
// read. The trigger shows `native` alone: the full label rendered there was
// 157px wide, which was a large part of why the navbar overflowed the viewport.
const languages: { code: Lang; native: string; label: string; flag: string }[] = [
  { code: "en", native: "English", label: "English — English", flag: "🇺🇸" },
  { code: "ar", native: "العربية", label: "العربية — Arabic", flag: "🇸🇦" },
  { code: "ur", native: "اردو", label: "اردو — Urdu", flag: "🇵🇰" },
  { code: "hi", native: "हिन्दी", label: "हिन्दी — Hindi", flag: "🇮🇳" },
  { code: "id", native: "Bahasa Indonesia", label: "Bahasa Indonesia — Indonesian", flag: "🇮🇩" },
  { code: "ja", native: "日本語", label: "日本語 — Japanese", flag: "🇯🇵" },
  { code: "it", native: "Italiano", label: "Italiano — Italian", flag: "🇮🇹" },
  { code: "ko", native: "한국어", label: "한국어 — Korean", flag: "🇰🇷" },
  { code: "nl", native: "Nederlands", label: "Nederlands — Dutch", flag: "🇳🇱" },
  { code: "pl", native: "Polski", label: "Polski — Polish", flag: "🇵🇱" },
  { code: "vi", native: "Tiếng Việt", label: "Tiếng Việt — Vietnamese", flag: "🇻🇳" },
  { code: "bn", native: "বাংলা", label: "বাংলা — Bengali", flag: "🇧🇩" },
  { code: "fa", native: "فارسی", label: "فارسی — Persian", flag: "🇮🇷" },
  { code: "es", native: "Español", label: "Español — Spanish", flag: "🇪🇸" },
  { code: "de", native: "Deutsch", label: "Deutsch — German", flag: "🇩🇪" },
  { code: "pt", native: "Português", label: "Português — Portuguese", flag: "🇧🇷" },
  { code: "zh", native: "中文", label: "中文 — Chinese", flag: "🇨🇳" },
  { code: "tr", native: "Türkçe", label: "Türkçe — Turkish", flag: "🇹🇷" },
  { code: "fr", native: "Français", label: "Français — French", flag: "🇫🇷" },
  { code: "ru", native: "Русский", label: "Русский — Russian", flag: "🇷🇺" },
];

interface LanguageSwitcherProps {
  /**
   * The desktop navbar is width-critical, so there the native name appears only
   * at 2xl. Everywhere else (settings pages, the mobile bar) it shows from sm up.
   */
  compact?: boolean;
}

export function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { lang, setLang, t } = useLanguage();
  const current = languages.find((l) => l.code === lang);

  return (
    <DropdownMenu>
      {/* The visible text is the native name only, so the accessible name carries
          the full label — a screen reader still hears which language is active,
          which the bare "Select language" never said. */}
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={current ? `${t("settings.selectLang")}: ${current.label}` : t("settings.selectLang")}
          className="gap-1.5 text-sm px-2"
        >
          <span className="text-base" aria-hidden="true">{current?.flag}</span>
          <span className={compact ? "hidden 2xl:inline" : "hidden sm:inline"}>{current?.native}</span>
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
