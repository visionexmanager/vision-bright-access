// Pure half of the assistive equipment reference adapter.
//
// This is the one source that needs no key, no approval and no merchant: 21
// researched equipment types with the range the market actually charges, kept
// in the repository and snapshotted from `src/data/assistiveProducts.ts`.
//
// It exists because of what the audience asks. "How much is a braille
// display?" is a question the agent could not answer at all — the catalogue is
// empty, no external source is switched on, and the honest reply was silence.
// A researched range and a sourcing request is a real answer, and it is
// available today.
//
// What it must never do is pretend to be stock. Nobody has quoted a price for
// one of these today and nobody is holding one, so every record comes back
// with no single price, a range, and `requires_sourcing_confirmation`.

import type { RawResult, SourcingIntent } from "../types.ts";

export interface AssistiveRecord {
  id: string;
  category: string;
  title_en: string;
  title_ar: string;
  title_es: string;
  access_type: string;
  price_min_usd: number;
  price_max_usd: number;
  specs_en: string[];
  specs_ar: string[];
  text: string;
}

/**
 * Fold the spellings of the same Arabic word together.
 *
 * Only the uncontroversial ones: the diacritics and the tatweel a keyboard may
 * or may not produce, and the letter pairs writers use interchangeably. Zero
 * width joiners are deliberately left alone — they carry meaning in Persian and
 * Urdu, and stripping them corrupts words that look identical afterwards.
 */
export function normalizeArabic(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي");
}

/**
 * The stem an Arabic plural and its singular share.
 *
 * "شاشات بريل" must find "شاشة بريل", and a substring search never will: the
 * plural is not a substring of the singular in either direction. Stripping the
 * definite article and the common plural endings makes both sides meet at
 * "شاش". Nothing is stemmed below three characters — a two-letter fragment
 * matches half the catalogue, which is the hazard this codebase has hit in
 * search before.
 */
export function arabicStem(word: string): string {
  let stem = word;
  if (stem.length > 4 && stem.startsWith("ال")) stem = stem.slice(2);
  for (const suffix of ["ات", "ون", "ين", "ها", "هم", "ية"]) {
    if (stem.length > 4 && stem.endsWith(suffix)) {
      stem = stem.slice(0, -suffix.length);
      break;
    }
  }
  return stem.length >= 3 ? stem : word;
}

/**
 * How well a record answers the request.
 *
 * The share of the caller's keywords found in the record's retrieval text, with
 * a title hit worth more than a specification hit — "braille display" should
 * beat a notetaker that merely mentions braille cells in its specs.
 */
export function assistiveScore(record: AssistiveRecord, keywords: string[]): number {
  if (keywords.length === 0) return 0;

  const titles = normalizeArabic(`${record.title_en} ${record.title_ar} ${record.title_es}`);
  const body = normalizeArabic(record.text);

  let hits = 0;
  for (const keyword of keywords) {
    const term = normalizeArabic(keyword);
    const stem = arabicStem(term);

    if (titles.includes(term) || titles.includes(stem)) hits += 1;
    else if (body.includes(term) || body.includes(stem)) hits += 0.4;
  }
  return hits / keywords.length;
}

/** Below the threshold a record is not an answer, it is a coincidence. */
export const ASSISTIVE_MIN_SCORE = 0.34;

/**
 * A record, in the shape every other source is reduced to.
 *
 * `sourcePriceUsd` is deliberately null. The pricing engine answers a missing
 * source price with "price on request" rather than a guess, which is exactly
 * right here: quoting the bottom of a $500–$2,500 range as the price, and then
 * adding a margin to it, would put a number on the screen that nobody can
 * honour.
 */
export function assistiveToRaw(record: AssistiveRecord, score: number, language: string): RawResult {
  const arabic = language.startsWith("ar");

  return {
    title: arabic ? record.title_ar : record.title_en,
    brand: null,
    model: null,
    category: "assistive",
    specifications: {
      ...(arabic
        ? { المواصفات: record.specs_ar.join(" · "), "الاسم بالإنجليزية": record.title_en }
        : { features: record.specs_en.join(" · ") }),
      type: record.category.replace(/-/g, " "),
      helps_with: record.access_type,
    },
    condition: "new",
    // No single price is known, so none is reported. The range is.
    sourcePriceUsd: null,
    priceRangeUsd: { min: record.price_min_usd, max: record.price_max_usd },
    shippingUsd: 0,
    currency: "USD",
    sourceUrl: "/assistive-products",
    sourceProductId: record.id,
    // A researched type, not a listing anybody has confirmed today.
    availability: "requires_sourcing_confirmation",
    confidence: Math.min(0.65, Math.round(score * 100) / 100),
  };
}

/** The records worth returning, best first. */
export function searchAssistive(
  records: AssistiveRecord[],
  intent: SourcingIntent,
  limit: number,
  language: string,
): RawResult[] {
  return records
    .map((record) => ({ record, score: assistiveScore(record, intent.keywords) }))
    .filter(({ score }) => score >= ASSISTIVE_MIN_SCORE)
    .filter(({ record }) => {
      // A budget rules a type out only when the whole range sits outside it:
      // "under $600" should still surface a $500–$2,500 display, because the
      // cheap end of that market is inside what was asked for.
      if (intent.maxPriceUsd !== null && record.price_min_usd > intent.maxPriceUsd) return false;
      if (intent.minPriceUsd !== null && record.price_max_usd < intent.minPriceUsd) return false;
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ record, score }) => assistiveToRaw(record, score, language));
}
