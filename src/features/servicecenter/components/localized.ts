import type { Lang } from "@/contexts/LanguageContext";
import type { LocalizedList, LocalizedText } from "../types";

/**
 * Catalog copy ships as English + Arabic pairs. For the other nine locales we
 * render the English string, which the LanguageContext DOM translator then
 * rewrites where it has a match — the same path the rest of the app uses for
 * data-driven copy.
 */
export function pick(value: LocalizedText, lang: Lang): string {
  return lang === "ar" ? value.ar : value.en;
}

export function pickList(value: LocalizedList, lang: Lang): string[] {
  return lang === "ar" ? value.ar : value.en;
}
