import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assistiveCategories } from "@/data/assistiveProducts";
import { ASSISTIVE_INDEX_PATH, buildAssistiveIndex } from "@/features/commerce/assistiveIndex";
import {
  arabicStem,
  ASSISTIVE_MIN_SCORE,
  assistiveScore,
  normalizeArabic,
  assistiveToRaw,
  searchAssistive,
  type AssistiveRecord,
} from "../../supabase/functions/_shared/sourcing/adapters/assistiveGuideMapping.ts";
import { parseIntent } from "../../supabase/functions/_shared/sourcing/router.ts";
import { calculatePrice } from "../../supabase/functions/_shared/sourcing/pricing.ts";

// The reference stays the single source of truth and is indexed rather than
// copied into a table — the same decision already taken for services. That
// only holds if the snapshot the agent reads cannot drift from it.

const snapshot = JSON.parse(readFileSync(ASSISTIVE_INDEX_PATH, "utf8")) as AssistiveRecord[];
const migration = readFileSync("supabase/migrations/20261003000000_sourcing_assistive_guide.sql", "utf8");
const adapter = readFileSync(
  "supabase/functions/_shared/sourcing/adapters/assistiveGuide.ts",
  "utf8",
);

describe("assistive index snapshot", () => {
  it("matches the reference exactly", () => {
    // Regenerate with: npx vite-node scripts/generate-assistive-index.ts
    expect(snapshot).toEqual(buildAssistiveIndex());
  });

  it("covers every product in every category", () => {
    const total = assistiveCategories.reduce((sum, category) => sum + category.products.length, 0);
    expect(snapshot).toHaveLength(total);
    expect(new Set(snapshot.map((record) => record.id)).size).toBe(total);
  });

  it("carries Arabic and English, so either language finds a thing", () => {
    for (const record of snapshot) {
      expect(record.text, `${record.id} missing English`).toContain(record.title_en);
      expect(record.text, `${record.id} missing Arabic`).toContain(record.title_ar);
    }
  });

  it("has a real price range on every record", () => {
    for (const record of snapshot) {
      // A zero floor is not missing data: screen readers start at free, and
      // saying so is the most useful thing this reference tells a blind user.
      expect(record.price_min_usd, record.id).toBeGreaterThanOrEqual(0);
      expect(record.price_max_usd, record.id).toBeGreaterThan(0);
      expect(record.price_max_usd, record.id).toBeGreaterThanOrEqual(record.price_min_usd);
    }
  });
});

describe("searching the guide", () => {
  it("answers a question the agent could not answer before", () => {
    const results = searchAssistive(snapshot, parseIntent("braille display"), 10, "en");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title.toLowerCase()).toContain("braille");
  });

  it("answers it in Arabic too", () => {
    const results = searchAssistive(snapshot, parseIntent("شاشة بريل"), 10, "ar");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toMatch(/بريل/);
  });

  it("finds the singular from the plural, which a substring search cannot", () => {
    // The question that exposed this: "شاشات" is not a substring of "شاشة" in
    // either direction, so before stemming the agent answered a plain Arabic
    // question about braille displays with nothing at all.
    const results = searchAssistive(snapshot, parseIntent("شو أسعار شاشات بريل؟"), 10, "ar");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toMatch(/شاشة بريل/);
    expect(results[0].priceRangeUsd).toEqual({ min: 500, max: 2500 });
  });

  it("folds the spellings of a word without touching Persian and Urdu joiners", () => {
    expect(normalizeArabic("أسعار")).toBe(normalizeArabic("اسعار"));
    expect(normalizeArabic("شاشة")).toBe(normalizeArabic("شاشه"));
    // ZWJ and ZWNJ carry meaning; stripping them corrupts words that then look
    // identical. They must survive.
    expect(normalizeArabic("می‌خواهم")).toContain("‌");
  });

  it("never stems a word down to a fragment that matches everything", () => {
    // Stemming may not create a fragment shorter than the three-character floor
    // this codebase learned to keep. (Words below it never arrive: parseIntent
    // has already dropped them.)
    for (const word of ["الي", "بريل", "شاشات", "قارئات", "الشاشات"]) {
      expect(arabicStem(word).length, word).toBeGreaterThanOrEqual(3);
    }
    expect(arabicStem("شاشات")).toBe("شاش");
    expect(arabicStem("الشاشات")).toBe("شاش");
  });

  it("returns nothing for something it does not cover, rather than the nearest thing", () => {
    expect(searchAssistive(snapshot, parseIntent("olive oil"), 10, "en")).toEqual([]);
    expect(searchAssistive(snapshot, parseIntent("refrigerator"), 10, "en")).toEqual([]);
  });

  it("reports a range and no price, so nothing is quoted that cannot be honoured", () => {
    const [first] = searchAssistive(snapshot, parseIntent("braille display"), 1, "en");
    expect(first.sourcePriceUsd).toBeNull();
    expect(first.priceRangeUsd!.min).toBeGreaterThan(0);
    expect(first.priceRangeUsd!.max).toBeGreaterThan(first.priceRangeUsd!.min);
    expect(first.availability).toBe("requires_sourcing_confirmation");
  });

  it("cannot be marked up, because there is no price to mark up", () => {
    const [first] = searchAssistive(snapshot, parseIntent("braille display"), 1, "en");
    const priced = calculatePrice(
      {
        sourcePriceUsd: first.sourcePriceUsd ?? null,
        shippingUsd: 0,
        condition: "new",
        category: "assistive",
        sourceSlug: "visionex-assistive-guide",
      },
      [{
        id: "r", name: "Default", source_slug: null, category: null, condition: null,
        margin_percent: 15, margin_flat_usd: 0, fees_percent: 3,
        apply_to_used: false, round_to: 1, active: true,
      }],
    );
    expect(priced.finalPriceUsd).toBeNull();
    expect(priced.breakdown.reason).toBe("no_source_price");
  });

  it("keeps a type whose cheap end is inside the budget", () => {
    // A $500–$2,500 display is a real answer to "under $600"; the low end of
    // that market is exactly what was asked for.
    const results = searchAssistive(snapshot, parseIntent("braille display under 600"), 10, "en");
    expect(results.length).toBeGreaterThan(0);
  });

  it("drops a type whose whole range is out of reach", () => {
    const results = searchAssistive(snapshot, parseIntent("braille display under 100"), 10, "en");
    expect(results.every((r) => (r.priceRangeUsd?.min ?? 0) <= 100)).toBe(true);
  });

  it("scores a title match above a specification mention", () => {
    const record: AssistiveRecord = {
      id: "x", category: "braille-technology",
      title_en: "Braille Display", title_ar: "شاشة بريل", title_es: "Pantalla",
      access_type: "visual", price_min_usd: 500, price_max_usd: 2500,
      specs_en: ["braille cells"], specs_ar: ["خلايا بريل"],
      text: "Braille Display. شاشة بريل. Pantalla. braille cells",
    };
    const other: AssistiveRecord = { ...record, id: "y", title_en: "Notetaker", title_ar: "مدوّن" };

    expect(assistiveScore(record, ["braille", "display"]))
      .toBeGreaterThan(assistiveScore(other, ["braille", "display"]));
  });

  it("never claims more confidence than a real catalogue hit", () => {
    for (const result of searchAssistive(snapshot, parseIntent("braille display"), 10, "en")) {
      expect(result.confidence).toBeLessThanOrEqual(0.65);
      expect(result.confidence).toBeGreaterThanOrEqual(ASSISTIVE_MIN_SCORE * 0.9);
    }
  });

  it("answers in the language the question was asked in", () => {
    const record = snapshot[0];
    expect(assistiveToRaw(record, 0.9, "ar").title).toBe(record.title_ar);
    expect(assistiveToRaw(record, 0.9, "en").title).toBe(record.title_en);
    expect(adapter).toContain("languageOf");
  });

  it("is switched on, and needs nothing to be", () => {
    expect(migration).toContain("'visionex-assistive-guide'");
    expect(migration).toContain("'internal', 'active'");
    expect(adapter).not.toContain("Deno.env");
    expect(adapter).not.toContain("fetch(");
  });
});
