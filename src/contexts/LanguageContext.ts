import { createContext, useContext } from "react";

// The provider, the lazy dictionary loader and the DOM fallback translator all
// live in ./LanguageProvider. useLanguage is imported in hundreds of files, so
// it stays here in a module that exports no components and can hot-reload.

export const supportedLangs = ["en", "ar", "ur", "hi", "id", "ja", "it", "ko", "nl", "pl", "vi", "bn", "fa", "es", "de", "pt", "zh", "tr", "fr", "ru"] as const;
export type Lang = (typeof supportedLangs)[number];

interface LanguageContextType {
  lang: Lang;
  ready: boolean;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
  translateText: (text: string) => string;
  dir: "ltr" | "rtl";
}

export const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  ready: false,
  setLang: () => {},
  t: (key) => key,
  translateText: (text) => text,
  dir: "ltr",
});

export const useLanguage = () => useContext(LanguageContext);
