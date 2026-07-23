/**
 * Translation target languages for the AI Translator — a fixed picker
 * rather than free text, per spec. Deliberately separate from the app's 11
 * UI locales (src/i18n/*): a translation TARGET is just a plain-language
 * name sent to the model's prompt, not a UI string set, so a language like
 * Japanese can be offered here without adding a 12th full i18n locale.
 * Names are shown in their own native form, not re-translated per app
 * locale.
 */
export interface TranslationLanguage {
  code: string;
  /** Sent to the model as-is (translate-paragraph's targetLanguage param). */
  name: string;
  nativeName: string;
}

export const TRANSLATION_LANGUAGES: TranslationLanguage[] = [
  { code: "ar", name: "Arabic", nativeName: "العربية" },
  { code: "en", name: "English", nativeName: "English" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe" },
  { code: "ru", name: "Russian", nativeName: "Русский" },
  { code: "zh", name: "Chinese", nativeName: "中文" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
  { code: "ur", name: "Urdu", nativeName: "اردو" },
];
