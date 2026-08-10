import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const locales = ["en", "ar", "es", "de", "pt", "zh", "tr", "fr", "ru", "ur", "hi"];

function dictionaryKeys(locale: string) {
  const source = readFileSync(`src/i18n/${locale}.ts`, "utf8");
  return [...source.matchAll(/^\s{2}"([^"]+)":/gm)].map((match) => match[1]);
}

describe("global i18n integrity", () => {
  it("keeps every locale at full key parity without duplicate keys", () => {
    const englishKeys = dictionaryKeys("en");
    const expected = new Set(englishKeys);

    expect(expected.size).toBe(englishKeys.length);
    expect(expected.size).toBeGreaterThan(12_000);

    for (const locale of locales.filter((value) => value !== "en")) {
      const keys = dictionaryKeys(locale);
      const unique = new Set(keys);
      const missing = englishKeys.filter((key) => !unique.has(key));
      const extra = keys.filter((key) => !expected.has(key));

      expect(unique.size, `${locale} contains duplicate translation keys`).toBe(keys.length);
      expect(missing, `${locale} is missing translation keys`).toEqual([]);
      expect(extra, `${locale} contains keys absent from English`).toEqual([]);
    }
  });

  it("never builds translated sentences by replacing isolated DOM words", () => {
    const source = readFileSync("src/contexts/LanguageContext.tsx", "utf8");

    expect(source).toContain("type SortedEntries = null");
    expect(source).toContain("return { map, sorted: null }");
    expect(source).not.toContain("value.replace(sorted.pattern");
    expect(source).not.toContain("new RegExp(");
  });
});
