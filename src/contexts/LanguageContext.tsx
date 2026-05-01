import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import en from "@/i18n/en";
import ar from "@/i18n/ar";
import es from "@/i18n/es";
import de from "@/i18n/de";
import pt from "@/i18n/pt";
import zh from "@/i18n/zh";
import tr from "@/i18n/tr";
import fr from "@/i18n/fr";
import ru from "@/i18n/ru";
import ur from "@/i18n/ur";
import hi from "@/i18n/hi";

export const supportedLangs = ["en", "ar", "es", "de", "pt", "zh", "tr", "fr", "ru", "ur", "hi"] as const;
export type Lang = (typeof supportedLangs)[number];

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
  dir: "ltr" | "rtl";
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  setLang: () => {},
  t: (key) => key,
  dir: "ltr",
});

export const useLanguage = () => useContext(LanguageContext);

const translations: Record<Lang, Record<string, string>> = {
  en,
  ar,
  es,
  de,
  pt,
  zh,
  tr,
  fr,
  ru,
  ur,
  hi,
};

const rtlLangs: Lang[] = ["ar", "ur"];

function detectBrowserLang(): Lang {
  try {
    const browserLangs = navigator.languages || [navigator.language];
    for (const bl of browserLangs) {
      const code = bl.split("-")[0].toLowerCase();
      if (supportedLangs.includes(code as Lang)) {
        return code as Lang;
      }
    }
  } catch {
    // SSR or no navigator
  }
  return "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem("visionex-lang") as Lang | null;
    if (saved && supportedLangs.includes(saved)) return saved;
    return detectBrowserLang();
  });

  const dir = rtlLangs.includes(lang) ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    localStorage.setItem("visionex-lang", lang);
  }, [lang, dir]);

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
  }, []);

  const t = useCallback(
    (key: string): string => {
      return translations[lang]?.[key] || translations.en[key] || key;
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}
