// Answering in the language the person wrote in — silently.
//
// The assistant never announces that it follows the sender's language and
// never asks which one to use: a message in German is answered in German, one
// in Arabic in Arabic, with no remark about it. When a message carries no
// language of its own («ok», «2», an email address) the previous one decides.
//
// Two signals, both free:
//   • a script that belongs to one language (Arabic, Cyrillic, Hangul, kana…)
//     is decisive — `detectLanguageCode` already knows these, Persian and Urdu
//     included;
//   • among Latin-script languages, function words tell them apart. The weights
//     in `chatLangId.ts` are mined from Tatoeba: how exclusively each common
//     word belongs to one language.
//
// "Confident" is a deliberate threshold. A guess is worse than a fallback: a
// message that merely contains a word two languages share keeps the language
// the conversation was already in.

import { detectLanguageCode } from "./whatsapp.ts";
import { fold } from "./chatSignup.ts";
import { LANG_ID } from "./chatLangId.ts";
import { LEXICON } from "./chatPhraseLexicon.ts";
import { type SupportedLanguage } from "./whatsappLanguages.ts";

export interface Detected {
  lang: SupportedLanguage;
  confident: boolean;
}

const NON_LATIN = /[؀-ۿݐ-ݿऀ-ॿঀ-৿Ѐ-ӿ฀-๿぀-ヿ㐀-鿿가-힯ᄀ-ᇿﭐ-﷿ﹰ-﻿]/u;
const LETTER = /\p{L}/u;

/** Greeting phrases that exist in more than one language prove nothing; keep only the ones that belong to one. */
const OWNED_GREETINGS: ReadonlyMap<string, SupportedLanguage> = (() => {
  const owner = new Map<string, SupportedLanguage | null>();
  for (const [lang, v] of Object.entries(LEXICON)) {
    for (const phrase of v.greeting) {
      const key = fold(phrase);
      if (!key || NON_LATIN.test(key)) continue;
      owner.set(key, owner.has(key) && owner.get(key) !== lang ? null : (lang as SupportedLanguage));
    }
  }
  const out = new Map<string, SupportedLanguage>();
  for (const [k, v] of owner) if (v) out.set(k, v);
  return out;
})();

/** Strip what carries no language: addresses, links, digits. */
function wordsOf(text: string): string {
  return text.replace(/\S+@\S+/g, " ").replace(/https?:\/\/\S+/g, " ").replace(/[\d_]+/g, " ");
}

export function detectChatLanguage(text: string | null | undefined): Detected {
  const raw = wordsOf((text ?? "").slice(0, 400));
  if (!LETTER.test(raw)) return { lang: "en", confident: false };

  if (NON_LATIN.test(raw)) {
    const lang = detectLanguageCode(raw);
    // Thai is not supported (the detector answers English): not a confident English.
    return { lang, confident: !/[฀-๿]/u.test(raw) };
  }

  const folded = fold(raw);
  const tokens = folded.split(" ").filter(Boolean);
  const scores = new Map<string, number>();
  const add = (lang: string, w: number) => scores.set(lang, (scores.get(lang) ?? 0) + w);

  for (const t of new Set(tokens)) {
    for (const [lang, table] of Object.entries(LANG_ID)) {
      const w = table[t];
      if (w) add(lang, w);
    }
  }
  const greeted = OWNED_GREETINGS.get(folded);
  if (greeted) add(greeted, 2);

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return { lang: "en", confident: false };
  const [best, second] = [ranked[0], ranked[1]];
  const margin = best[1] - (second?.[1] ?? 0);
  // One strong word, or a couple of weaker ones, and clearly ahead of the runner-up.
  const confident = best[1] >= 1.0 && margin >= 0.5;
  return { lang: best[0] as SupportedLanguage, confident };
}

/**
 * The language to answer in: the message's own when it clearly has one,
 * otherwise whatever the conversation was already in, otherwise the fallback.
 */
export function languageFor(
  text: string | null | undefined,
  previous: string | null | undefined,
  fallback: SupportedLanguage = "en",
): SupportedLanguage {
  const d = detectChatLanguage(text);
  if (d.confident) return d.lang;
  if (previous && previous in LANG_ID_OR_OTHER) return previous as SupportedLanguage;
  return fallback;
}

/** Every language we can answer in (Latin ones from the table, the rest by script). */
const LANG_ID_OR_OTHER: Record<string, true> = Object.fromEntries(
  ["en", "ar", "ur", "hi", "id", "ja", "it", "ko", "nl", "pl", "vi", "bn", "fa", "es", "de", "pt", "zh", "tr", "fr", "ru"].map((l) => [l, true]),
);
