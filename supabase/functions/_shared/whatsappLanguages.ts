// The languages Visionex speaks, in one place.
//
// The list, the codes, the direction of the script and the name each language
// calls itself. Everything that has to know which languages exist reads it from
// here: the language menu a new sender is offered, the directive the model is
// given, the fallback a half-translated label falls back to.
//
// ── Why this file exists at all ──────────────────────────────────────────────
//
// The site keeps the same list in `src/contexts/LanguageContext.ts`, and the two
// cannot import each other: this runs in Deno inside an Edge Function and that
// runs in a browser bundle. So the list is written twice and a test asserts the
// two are identical, character for character. That test is the join — without
// it, adding a twenty-first language to the site would leave WhatsApp offering
// twenty forever, and nobody would notice until somebody complained.
//
// Pure: no `Deno`, no fetch, no database. Just the list and how to read it.

/**
 * The twenty languages the Visionex site is translated into, in the site's own
 * order — the most likely two first, then the rest as the site lists them.
 *
 * Order is part of the contract, not a detail: a screen-reader user who has
 * learned that their language is the fourth row should find it there tomorrow.
 */
export const SUPPORTED_LANGUAGES = [
  "en", "ar", "ur", "hi", "id", "ja", "it", "ko", "nl", "pl",
  "vi", "bn", "fa", "es", "de", "pt", "zh", "tr", "fr", "ru",
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export function isSupportedLanguage(value: string | null | undefined): value is SupportedLanguage {
  return !!value && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/** Right-to-left scripts, so a reply is never wrapped in left-to-right chrome. */
const RTL: ReadonlySet<string> = new Set(["ar", "fa", "ur"]);
export const isRtl = (language: string): boolean => RTL.has(language);

/** Endonym, used to instruct the model rather than to show the user. */
export const LANGUAGE_ENDONYM: Record<SupportedLanguage, string> = {
  ar: "Arabic", bn: "Bengali", de: "German", en: "English", es: "Spanish",
  fa: "Persian", fr: "French", hi: "Hindi", id: "Indonesian", it: "Italian",
  ja: "Japanese", ko: "Korean", nl: "Dutch", pl: "Polish", pt: "Portuguese",
  ru: "Russian", tr: "Turkish", ur: "Urdu", vi: "Vietnamese", zh: "Chinese",
};

/**
 * What each language calls itself, and what English calls it.
 *
 * Both halves are shown, exactly as the site's language switcher shows them:
 * the native name is what a reader recognises, and the English name is what
 * lets somebody find a language whose script they cannot yet read. Copied from
 * `src/components/LanguageSwitcher.tsx` and asserted identical by the suite.
 */
export interface LanguageChoice {
  code: SupportedLanguage;
  /** The name the language uses for itself. Shown as the row's title. */
  native: string;
  /** The English name. Shown as the row's description. */
  english: string;
}

export const LANGUAGE_CHOICES: readonly LanguageChoice[] = [
  { code: "en", native: "English", english: "English" },
  { code: "ar", native: "العربية", english: "Arabic" },
  { code: "ur", native: "اردو", english: "Urdu" },
  { code: "hi", native: "हिन्दी", english: "Hindi" },
  { code: "id", native: "Bahasa Indonesia", english: "Indonesian" },
  { code: "ja", native: "日本語", english: "Japanese" },
  { code: "it", native: "Italiano", english: "Italian" },
  { code: "ko", native: "한국어", english: "Korean" },
  { code: "nl", native: "Nederlands", english: "Dutch" },
  { code: "pl", native: "Polski", english: "Polish" },
  { code: "vi", native: "Tiếng Việt", english: "Vietnamese" },
  { code: "bn", native: "বাংলা", english: "Bengali" },
  { code: "fa", native: "فارسی", english: "Persian" },
  { code: "es", native: "Español", english: "Spanish" },
  { code: "de", native: "Deutsch", english: "German" },
  { code: "pt", native: "Português", english: "Portuguese" },
  { code: "zh", native: "中文", english: "Chinese" },
  { code: "tr", native: "Türkçe", english: "Turkish" },
  { code: "fr", native: "Français", english: "French" },
  { code: "ru", native: "Русский", english: "Russian" },
];

// ── The ids the interactive rows carry ───────────────────────────────────────
//
// A tapped row sends back an id, never the label. The label is a translation
// and translations change; the id is written to a database and read back later.
// `language.fr` means French in every build this row survives into, and a row
// titled «Français» that sent back "Français" would stop meaning anything the
// day somebody fixed a spelling.

export const LANGUAGE_ID_PREFIX = "language.";
export const LANGUAGE_PAGE_PREFIX = "language.page.";

/** The row id that selects one language. */
export const languageRowId = (code: SupportedLanguage): string => `${LANGUAGE_ID_PREFIX}${code}`;

/** The row id that turns to another page of the language list. */
export const languagePageId = (page: number): string => `${LANGUAGE_PAGE_PREFIX}${page}`;

/**
 * The language a tapped row selected, or null.
 *
 * Null for a page-turn, for an id this build does not know, and for anything
 * that is not a language row at all. The caller keeps the sender in language
 * selection on null rather than guessing, which is the whole point: a malformed
 * payload must never be able to pick a language on somebody's behalf.
 */
export function parseLanguageSelection(id: string | null | undefined): SupportedLanguage | null {
  if (!id || !id.startsWith(LANGUAGE_ID_PREFIX)) return null;
  if (id.startsWith(LANGUAGE_PAGE_PREFIX)) return null;
  const code = id.slice(LANGUAGE_ID_PREFIX.length);
  return isSupportedLanguage(code) ? code : null;
}

/** The page a tapped row turned to, or null. Out-of-range pages are null. */
export function parseLanguagePage(id: string | null | undefined): number | null {
  if (!id || !id.startsWith(LANGUAGE_PAGE_PREFIX)) return null;
  const page = Number(id.slice(LANGUAGE_PAGE_PREFIX.length));
  if (!Number.isInteger(page) || page < 1 || page > LANGUAGE_PAGE_COUNT) return null;
  return page;
}

/**
 * How many languages fit on one page.
 *
 * Meta allows ten rows in an interactive list, in total, across every section.
 * Twenty languages therefore cannot be one message, and the tenth row is spent
 * on turning the page — so nine languages fit, and the list runs to three
 * pages. This is a hard limit of the platform: a list of eleven rows is not
 * truncated by Meta, it is rejected, and the sender receives nothing at all.
 */
export const LANGUAGES_PER_PAGE = 9;

export const LANGUAGE_PAGE_COUNT = Math.ceil(LANGUAGE_CHOICES.length / LANGUAGES_PER_PAGE);

/** The languages on one page, 1-based. An out-of-range page yields the first. */
export function languagesOnPage(page: number): readonly LanguageChoice[] {
  const index = Number.isInteger(page) && page >= 1 && page <= LANGUAGE_PAGE_COUNT ? page : 1;
  const start = (index - 1) * LANGUAGES_PER_PAGE;
  return LANGUAGE_CHOICES.slice(start, start + LANGUAGES_PER_PAGE);
}

/** The page a row leads to next: forward, wrapping at the end. Never a dead end. */
export const nextLanguagePage = (page: number): number =>
  page >= LANGUAGE_PAGE_COUNT ? 1 : page + 1;

/**
 * The one instruction that makes the reply match the user. Appended to the
 * assistant's own system prompt rather than replacing it.
 */
export function languageDirective(language: SupportedLanguage): string {
  const name = LANGUAGE_ENDONYM[language];
  const rtl = isRtl(language)
    ? " Write naturally right-to-left; do not wrap the reply in Latin punctuation or brackets."
    : "";
  return `Reply entirely in ${name}. Do not mix in another language unless the user did, or unless a product name, URL or code has no translation.${rtl}`;
}
