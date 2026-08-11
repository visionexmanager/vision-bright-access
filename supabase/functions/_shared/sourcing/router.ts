// Intent parsing, source routing, de-duplication and ranking.
//
// No vendor is named anywhere in this file. Routing is driven entirely by the
// `categories` and `conditions` arrays on rows in `sourcing_sources`, so an
// admin adds or retires a supplier without touching this logic — spec §4.

import type {
  ConditionFilter,
  NormalizedResult,
  ProductCondition,
  SourceRecord,
  SourcingIntent,
} from "./types.ts";

// Signals are per-category word lists rather than per-vendor rules, so the
// router keeps working when the set of suppliers changes.
const CATEGORY_SIGNALS: Array<{ category: string; patterns: RegExp[] }> = [
  {
    category: "assistive",
    patterns: [
      /\b(braille|screen reader|ocr|magnifier|low vision|blind|visually impaired|talking|accessib\w*)\b/i,
      /(برايل|قارئ الشاشة|قارئ شاشة|مكبر|ضعاف البصر|كفيف|مكفوف|ناطق|إتاحة|اتاحة)/,
    ],
  },
  {
    category: "electronics",
    patterns: [
      /\b(laptop|computer|phone|tablet|headphone|earbud|monitor|keyboard|camera|power ?bank|charger|ssd|router)\b/i,
      /(لابتوب|حاسوب|كمبيوتر|هاتف|جوال|تابلت|سماعة|شاشة|كيبورد|كاميرا|باور بانك|شاحن)/,
    ],
  },
  {
    category: "appliances",
    patterns: [
      /\b(vacuum|fridge|refrigerator|washing machine|microwave|oven|blender|air conditioner)\b/i,
      /(مكنسة|ثلاجة|غسالة|ميكروويف|فرن|خلاط|مكيف)/,
    ],
  },
  {
    category: "fashion",
    patterns: [/\b(shirt|dress|shoes|jacket|clothing|abaya|hijab|trousers)\b/i, /(قميص|فستان|حذاء|جاكيت|ملابس|عباية|حجاب|بنطال)/],
  },
  {
    category: "home",
    patterns: [/\b(furniture|sofa|table|chair|mattress|curtain|lamp)\b/i, /(أثاث|كنبة|طاولة|كرسي|مرتبة|ستارة|مصباح)/],
  },
  {
    category: "automotive",
    patterns: [/\b(car|tyre|tire|engine oil|battery|vehicle)\b/i, /(سيارة|إطار|زيت محرك|بطارية|مركبة)/],
  },
  {
    category: "children",
    patterns: [/\b(toy|stroller|kids|children)\b/i, /(لعبة|عربة أطفال|أطفال)/],
  },
];

const USED_SIGNALS = [/\b(used|second[- ]hand|pre[- ]owned)\b/i, /(مستعمل|مستعملة|سكند هاند)/];
const REFURB_SIGNALS = [/\b(refurbish\w*|renewed)\b/i, /(مجدد|مجددة|مُجدد)/];
const NEW_SIGNALS = [/\bbrand new\b/i, /\bnew\b/i, /(جديد|جديدة)/];

/** Very small words carry no meaning and match everything; drop them. */
const STOPWORDS = new Set([
  "the", "a", "an", "for", "with", "and", "or", "of", "to", "in", "on", "i", "need", "want", "buy", "looking",
  "في", "من", "على", "عن", "الى", "إلى", "مع", "هو", "هي", "بدي", "أريد", "اريد", "محتاج",
]);

function matches(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

/** Pull a budget out of phrasing like "around $500" or "تحت 500 دولار". */
function parseBudget(text: string): { max: number | null; min: number | null } {
  const amounts = [...text.matchAll(/(?:\$|usd\s*)?(\d{2,6})(?:\s*(?:\$|usd|dollars?|دولار))?/gi)]
    .map((match) => Number(match[1]))
    .filter((value) => value >= 10 && value <= 1_000_000);

  if (amounts.length === 0) return { max: null, min: null };

  const under = /\b(under|below|less than|up to|around|about|max)\b|(تحت|أقل من|اقل من|حوالي|بحدود|كحد أقصى)/i.test(text);
  const over = /\b(over|above|more than|at least|min)\b|(فوق|أكثر من|اكثر من|على الأقل)/i.test(text);

  if (amounts.length >= 2 && /\b(between|from)\b|(بين|من)/i.test(text)) {
    const sorted = [...amounts].sort((a, b) => a - b);
    return { min: sorted[0], max: sorted[sorted.length - 1] };
  }
  if (over) return { min: Math.max(...amounts), max: null };
  if (under) return { min: null, max: Math.max(...amounts) };
  // A bare number next to a product is nearly always a ceiling.
  return { min: null, max: Math.max(...amounts) };
}

export function parseIntent(query: string, explicitCondition?: ConditionFilter): SourcingIntent {
  const text = query.trim();

  let condition: ConditionFilter = explicitCondition ?? "all";
  if (!explicitCondition) {
    if (matches(text, USED_SIGNALS)) condition = "used";
    else if (matches(text, REFURB_SIGNALS)) condition = "refurbished";
    else if (matches(text, NEW_SIGNALS)) condition = "new";
  }

  const category = CATEGORY_SIGNALS.find((entry) => matches(text, entry.patterns))?.category ?? null;
  const budget = parseBudget(text);

  const keywords = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}+]+/u)
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word));

  return {
    query: text,
    category,
    condition,
    maxPriceUsd: budget.max,
    minPriceUsd: budget.min,
    brand: null,
    keywords: [...new Set(keywords)].slice(0, 12),
    assistive: category === "assistive",
  };
}

/**
 * Pick the sources to ask, in order.
 *
 * The internal catalogue always comes first — Visionex's own data is checked
 * before anyone else's. External sources are filtered by whether they cover
 * the category and the requested condition, then ordered by the same
 * priority/health idea the provider hub already uses.
 */
export function routeSources(intent: SourcingIntent, sources: SourceRecord[]): SourceRecord[] {
  const usable = sources.filter((source) => source.status === "active" && source.health_score > 20);

  const internal = usable.filter((source) => source.access_method === "internal");
  const external = usable
    .filter((source) => source.access_method !== "internal")
    .filter((source) => {
      // Category and condition are independent axes. A used-goods marketplace
      // is defined by what condition it sells, not by product category, so a
      // generalist must match any category rather than only an unclassified
      // request — otherwise "used Dell laptop" classifies as electronics and
      // reaches no marketplace at all.
      const coversCategory =
        source.categories.includes("all") ||
        source.categories.includes("general") ||
        (intent.category !== null && source.categories.includes(intent.category));

      const coversCondition =
        intent.condition === "all" || source.conditions.includes(intent.condition as ProductCondition);

      return coversCategory && coversCondition;
    })
    .sort((a, b) => {
      // A source that names the exact category is preferred over a generalist,
      // which is what makes "OCR device" reach assistive suppliers and
      // "vacuum cleaner" reach general retail.
      const specific = (source: SourceRecord) =>
        intent.category && source.categories.includes(intent.category) ? 0 : 1;
      const bySpecificity = specific(a) - specific(b);
      if (bySpecificity !== 0) return bySpecificity;
      const byPriority = a.priority - b.priority;
      if (byPriority !== 0) return byPriority;
      return b.health_score - a.health_score;
    });

  return [...internal, ...external];
}

/** Normalize for comparison: case, punctuation and spacing are not identity. */
function fingerprint(result: NormalizedResult): string {
  const parts = [result.brand, result.model || result.title]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
  return `${parts}|${result.condition}`;
}

/**
 * De-duplicate across sources. The same laptop from three suppliers is one
 * product; keep the cheapest priced offer, and prefer a priced one over an
 * unpriced one so the customer sees a number where any source had one.
 */
export function deduplicate(results: NormalizedResult[]): NormalizedResult[] {
  const best = new Map<string, NormalizedResult>();

  for (const result of results) {
    const key = fingerprint(result);
    const existing = best.get(key);
    if (!existing) {
      best.set(key, result);
      continue;
    }
    const existingPrice = existing.finalPriceUsd;
    const candidatePrice = result.finalPriceUsd;
    if (existingPrice === null && candidatePrice !== null) best.set(key, result);
    else if (existingPrice !== null && candidatePrice !== null && candidatePrice < existingPrice) {
      best.set(key, result);
    }
  }

  return [...best.values()];
}

/**
 * Rank by how well a result answers the request. Visionex's own stock wins
 * ties: if we have it, that is the better answer for the customer and for us.
 */
export function rank(results: NormalizedResult[], intent: SourcingIntent): NormalizedResult[] {
  const score = (result: NormalizedResult): number => {
    let value = result.confidence * 100;

    if (result.availability === "in_visionex") value += 40;
    else if (result.availability === "available_for_sourcing") value += 15;

    if (intent.maxPriceUsd !== null && result.finalPriceUsd !== null) {
      // Inside budget is good; over budget is penalised in proportion to the
      // overshoot rather than excluded, so a slightly-over option still shows.
      value += result.finalPriceUsd <= intent.maxPriceUsd
        ? 25
        : -Math.min(40, ((result.finalPriceUsd - intent.maxPriceUsd) / intent.maxPriceUsd) * 60);
    }

    if (result.finalPriceUsd === null) value -= 10;

    const haystack = `${result.title} ${result.brand ?? ""} ${result.model ?? ""}`.toLowerCase();
    value += intent.keywords.filter((word) => haystack.includes(word)).length * 4;

    return value;
  };

  return [...results].sort((a, b) => score(b) - score(a));
}

/**
 * Spec §7: new and used are shown as separate groups, never interleaved, so a
 * customer cannot mistake a second-hand listing for new stock.
 */
export function groupByCondition(results: NormalizedResult[]): {
  new: NormalizedResult[];
  used: NormalizedResult[];
  refurbished: NormalizedResult[];
} {
  return {
    new: results.filter((result) => result.condition === "new"),
    used: results.filter((result) => result.condition === "used"),
    refurbished: results.filter((result) => result.condition === "refurbished"),
  };
}
